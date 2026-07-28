import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

type MediaPart =
  | { kind: "image"; data_url: string }
  | { kind: "audio"; data: string; format: string }
  | { kind: "file"; filename: string; data_url: string };

const MediaPartSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), data_url: z.string().startsWith("data:image/") }),
  z.object({
    kind: z.literal("audio"),
    data: z.string().min(1),
    format: z.enum(["wav", "mp3", "webm", "m4a", "ogg", "aac", "flac"]),
  }),
  z.object({
    kind: z.literal("file"),
    filename: z.string().min(1).max(255),
    data_url: z.string().startsWith("data:"),
  }),
]);

const BodySchema = z.object({
  filename: z.string().max(255).optional(),
  media: z.array(MediaPartSchema).min(1).max(10),
  instruction: z.string().max(2000).optional(),
});

function extractModelText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text ?? "");
      return "";
    })
    .join("\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require an authenticated user
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid media payload", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filename, media, instruction } = parsed.data as {
      filename?: string;
      media: MediaPart[];
      instruction?: string;
    };

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "AI extraction is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content: any[] = [{
      type: "text",
      text: `${instruction || "Extract ALL educational content from the attached material."}

Rules:
- Transcribe every readable text verbatim (preserve Arabic/Urdu script and diacritics exactly as shown).
- For audio/video, produce a full transcript of the spoken content.
- For images/slides/frames, describe diagrams and list any tables, labels and captions.
- Do NOT summarise or add commentary. Output only the extracted content as plain text.`,
    }];

    for (const m of media) {
      if (m.kind === "image") content.push({ type: "image_url", image_url: { url: m.data_url } });
      else if (m.kind === "audio") content.push({ type: "input_audio", input_audio: { data: m.data, format: m.format } });
      else content.push({ type: "file", file: { filename: m.filename, file_data: m.data_url } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      const status = res.status === 429 || res.status === 402 ? res.status : 500;
      return new Response(JSON.stringify({ error: `Extraction failed: ${errText.slice(0, 500)}` }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const text = extractModelText(json?.choices?.[0]?.message?.content);

    return new Response(JSON.stringify({ filename: filename || "media", text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
