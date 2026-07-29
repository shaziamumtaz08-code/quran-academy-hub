// Background quiz generation worker.
// Processes ONE unit of work per invocation (a batch of PDF pages, one media file,
// or one generation batch) and then re-invokes itself, so books of any size can be
// processed without hitting edge-function time limits or the browser staying open.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { corsHeaders } from "../_shared/cors.ts";

const BUCKET = "quiz-sources";
const PDF_PAGE_BATCH = 8;
const GEN_CHUNK_CHARS = 12000;
const LOCK_SECONDS = 240;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const AUDIO_FORMATS: Record<string, string> = {
  mp3: "mp3", mpeg: "mp3", wav: "wav", webm: "webm", m4a: "m4a",
  mp4: "m4a", ogg: "ogg", aac: "aac", flac: "flac",
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function modelText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
    .join("\n")
    .trim();
}

async function callGateway(body: unknown) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up credits and resume the job.");
    throw new Error(`AI error ${res.status}: ${t.slice(0, 300)}`);
  }
  return await res.json();
}

const EXTRACT_RULES = `Rules:
- Transcribe every readable text verbatim (preserve Arabic/Urdu script and diacritics exactly as shown).
- For audio, produce a full transcript of the spoken content.
- For images/slides, describe diagrams and list any tables, labels and captions.
- Do NOT summarise or add commentary. Output only the extracted content as plain text.`;

async function extractParts(parts: any[], instruction: string): Promise<string> {
  const data = await callGateway({
    model: "google/gemini-3.6-flash",
    messages: [{ role: "user", content: [{ type: "text", text: `${instruction}\n\n${EXTRACT_RULES}` }, ...parts] }],
  });
  return modelText(data?.choices?.[0]?.message?.content);
}

function buildSystemPrompt(language: string, difficulty: string) {
  const lang = language === "ur" ? "Urdu" : language === "ar" ? "Arabic" : "English";
  const diff = difficulty === "mixed" ? "a mix of easy (30%), medium (40%) and hard (30%)" : difficulty;
  const scriptRules = (language === "ar" || language === "ur")
    ? `\nARABIC/URDU HANDLING:
- FIB correctText must be WITHOUT diacritics; add "correctAlt" with the diacritised form, a transliteration and common synonyms.
- Use localized TF options (["صحیح","غلط"] for Urdu, ["صح","خطأ"] for Arabic).
- Urdu in clean Urdu script (ک ی گ چ پ ٹ ڈ ڑ ھ ے). No Devanagari. Never mix Urdu and Arabic orthography.`
    : "";
  return `You are an expert examiner building a professional question bank in ${lang} at ${diff} difficulty.

ALLOWED TYPES ONLY: "mcq" (exactly 4 options, 0-based correctIndex), "tf" (exactly 2 options), "fib" (correctText + correctAlt, no options).
Embed advanced styles via an optional "subtype" field — never as a new type.

ALWAYS APPLY THESE DEFAULT FOCUS RULES:
- Only ask about the CORE TOPICS and concepts taught in the material.
- Ignore URLs, watermarks, headers/footers, publisher branding and navigation text.
- Never ask about publication dates, editions, author names, page numbers or document metadata.

QUALITY: unique non-repetitive concepts, meaningful distractors, difficulty spread, cover knowledge / structure / usage / conversation layers.

OUTPUT raw JSON only:
{"questions":[{"text":"","type":"mcq|tf|fib","subtype":"","difficulty":"easy|medium|hard","source":"grammar|dialogue|integrated","skill_layer":"knowledge|structure|usage|conversation","options":[],"correctIndex":0,"correctText":"","correctAlt":[],"explanation":""}]}${scriptRules}`;
}

const ALLOWED_TYPES = new Set(["mcq", "tf", "fib"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let jobId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    jobId = body?.job_id;
    if (!jobId) return json({ error: "job_id required" }, 400);

    const internal = req.headers.get("x-worker-secret") === serviceKey;
    if (!internal) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await asUser.auth.getUser();
      if (!userData?.user) return json({ error: "Unauthorized" }, 401);
      const { data: owned } = await admin
        .from("quiz_generation_jobs").select("id").eq("id", jobId).eq("created_by", userData.user.id).maybeSingle();
      if (!owned) return json({ error: "Forbidden" }, 403);
    }

    const { data: job, error: jobErr } = await admin
      .from("quiz_generation_jobs").select("*").eq("id", jobId).single();
    if (jobErr || !job) return json({ error: "Job not found" }, 404);

    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return json({ ok: true, status: job.status });
    }

    // Simple lease so two workers never process the same job at once.
    const now = Date.now();
    if (job.locked_until && new Date(job.locked_until).getTime() > now) {
      return json({ ok: true, skipped: "locked" });
    }
    await admin.from("quiz_generation_jobs")
      .update({ locked_until: new Date(now + LOCK_SECONDS * 1000).toISOString() })
      .eq("id", jobId);

    const cursor: any = job.cursor || {};
    const params: any = job.params || {};
    const files: any[] = job.files || [];
    let done = false;

    // ───────────────────────── EXTRACT STAGE ─────────────────────────
    if (job.stage === "extract") {
      const fi = cursor.file_index ?? 0;
      const file = files[fi];

      if (!file) {
        // Extraction finished → plan the generation batches.
        const { data: chunks } = await admin
          .from("quiz_generation_chunks").select("content").eq("job_id", jobId).order("seq");
        const totalChars = (chunks || []).reduce((s, c: any) => s + (c.content?.length || 0), 0);
        const batches = Math.max(1, Math.ceil(totalChars / GEN_CHUNK_CHARS));
        await admin.from("quiz_generation_jobs").update({
          stage: "generate",
          status: "generating",
          stage_message: `Extracted ${totalChars.toLocaleString()} characters — generating questions`,
          cursor: { batch: 0, batches },
          total_units: (job.processed_units || 0) + batches,
          locked_until: null,
        }).eq("id", jobId);
      } else {
        const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(file.path);
        if (dlErr || !blob) throw new Error(`Could not read ${file.name}: ${dlErr?.message || "missing"}`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const lower = String(file.name || "").toLowerCase();
        const isPdf = (file.type === "application/pdf") || lower.endsWith(".pdf");
        const seq = job.processed_units || 0;
        let text = "";
        let label = file.name;
        let nextCursor: any = { file_index: fi + 1, page: 0 };
        let extraUnits = 0;

        if (isPdf) {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pageCount = src.getPageCount();
          const start = cursor.page ?? 0;
          const end = Math.min(start + PDF_PAGE_BATCH, pageCount);

          if (start === 0) {
            // First touch of this PDF: expand the total unit count to its real page batches.
            extraUnits = Math.ceil(pageCount / PDF_PAGE_BATCH) - 1;
          }

          const slice = await PDFDocument.create();
          const copied = await slice.copyPages(src, Array.from({ length: end - start }, (_, i) => start + i));
          copied.forEach((p) => slice.addPage(p));
          const sliceBytes = await slice.save();

          label = `${file.name} — pages ${start + 1}-${end}`;
          text = await extractParts(
            [{ type: "file", file: { filename: `pages-${start + 1}-${end}.pdf`, file_data: `data:application/pdf;base64,${toBase64(sliceBytes)}` } }],
            `Extract all educational content from pages ${start + 1}-${end} of "${file.name}". OCR scanned pages if needed.`,
          );
          nextCursor = end >= pageCount ? { file_index: fi + 1, page: 0 } : { file_index: fi, page: end };
        } else if ((file.type || "").startsWith("image/")) {
          text = await extractParts(
            [{ type: "image_url", image_url: { url: `data:${file.type};base64,${toBase64(bytes)}` } }],
            "Read this image and transcribe all text, tables and diagram labels it contains.",
          );
        } else if ((file.type || "").startsWith("audio/")) {
          const ext = (file.type.split("/")[1] || lower.split(".").pop() || "mp3").toLowerCase();
          text = await extractParts(
            [{ type: "input_audio", input_audio: { data: toBase64(bytes), format: AUDIO_FORMATS[ext] || "mp3" } }],
            "Transcribe this audio recording in full, in its original language.",
          );
        } else {
          text = new TextDecoder().decode(bytes);
        }

        await admin.from("quiz_generation_chunks").insert({
          job_id: jobId, seq, label, content: `[SOURCE: ${label}]\n${(text || "").trim()}`,
        });

        await admin.from("quiz_generation_jobs").update({
          status: "extracting",
          processed_units: seq + 1,
          total_units: (job.total_units || 0) + extraUnits,
          stage_message: `Extracted ${label}`,
          cursor: nextCursor,
          locked_until: null,
        }).eq("id", jobId);
      }
    }

    // ───────────────────────── GENERATE STAGE ─────────────────────────
    else if (job.stage === "generate") {
      const batch = cursor.batch ?? 0;
      const batches = cursor.batches ?? 1;

      if (batch >= batches) {
        done = true;
      } else {
        const { data: chunks } = await admin
          .from("quiz_generation_chunks").select("content").eq("job_id", jobId).order("seq");
        const combined = (chunks || []).map((c: any) => c.content).join("\n\n");
        const window = combined.slice(batch * GEN_CHUNK_CHARS, (batch + 1) * GEN_CHUNK_CHARS);

        const mix = params.question_mix || { mcq: 5, tf: 3, fib: 2 };
        const perBatch = Object.entries(mix)
          .map(([t, c]) => [t, Math.max(1, Math.round(((c as number) * 3) / batches))] as const)
          .filter(([, c]) => c > 0)
          .map(([t, c]) => `${c} ${t}`)
          .join(", ");

        const custom = params.custom_instructions
          ? `\n\nADDITIONAL INSTRUCTIONS (follow strictly):\n${params.custom_instructions}`
          : "";

        const aiData = await callGateway({
          model: "google/gemini-3.6-flash",
          messages: [
            { role: "system", content: buildSystemPrompt(params.language || "en", params.difficulty_level || "mixed") },
            {
              role: "user",
              content: `Create approximately ${perBatch} questions from section ${batch + 1} of ${batches} of a larger book. Only use this section's content.${custom}\n\nCONTENT:\n${window}`,
            },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        });

        let parsed: any = {};
        try {
          parsed = JSON.parse(String(aiData?.choices?.[0]?.message?.content || "{}").replace(/```json/gi, "").replace(/```/g, "").trim());
        } catch {
          parsed = { questions: [] };
        }

        const newQuestions = (parsed.questions || []).map((q: any) => {
          if (!ALLOWED_TYPES.has(q.type)) {
            q.subtype = q.subtype || q.type;
            q.type = Array.isArray(q.options) && q.options.length > 0 ? "mcq" : "fib";
          }
          return q;
        });

        if (job.quiz_bank_id && newQuestions.length) {
          const { data: bank } = await admin
            .from("quiz_banks").select("question_bank").eq("id", job.quiz_bank_id).single();
          const existing = Array.isArray(bank?.question_bank) ? bank!.question_bank : [];
          await admin.from("quiz_banks")
            .update({ question_bank: [...existing, ...newQuestions] })
            .eq("id", job.quiz_bank_id);
        }

        const generated = (job.questions_generated || 0) + newQuestions.length;
        const nextBatch = batch + 1;
        const finished = nextBatch >= batches;

        if (finished && job.quiz_bank_id) {
          await admin.from("quiz_banks")
            .update({ source_content: combined.slice(0, 50000) })
            .eq("id", job.quiz_bank_id);
        }

        await admin.from("quiz_generation_jobs").update({
          status: finished ? "completed" : "generating",
          stage: finished ? "done" : "generate",
          questions_generated: generated,
          processed_units: (job.processed_units || 0) + 1,
          stage_message: finished
            ? `Completed — ${generated} questions generated`
            : `Generated questions from section ${nextBatch} of ${batches}`,
          cursor: { batch: nextBatch, batches },
          locked_until: null,
        }).eq("id", jobId);

        done = finished;
      }
    } else {
      done = true;
    }

    // Chain the next unit of work.
    if (!done) {
      fetch(`${supabaseUrl}/functions/v1/quiz-job-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          "x-worker-secret": serviceKey,
        },
        body: JSON.stringify({ job_id: jobId }),
      }).catch(() => {});
    }

    return json({ ok: true, done });
  } catch (e) {
    const message = (e as Error).message || "Worker failed";
    if (jobId) {
      const retryable = message === "RATE_LIMIT";
      await admin.from("quiz_generation_jobs").update({
        status: retryable ? "queued" : "failed",
        error: retryable ? "Rate limited — will resume shortly" : message,
        stage_message: retryable ? "Rate limited — waiting to resume" : "Failed",
        locked_until: null,
      }).eq("id", jobId);
    }
    return json({ error: message }, 500);
  }
});
