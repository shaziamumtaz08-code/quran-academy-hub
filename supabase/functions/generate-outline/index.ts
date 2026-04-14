import { corsHeaders } from "../_shared/cors.ts";
import { getLanguageInstruction } from "../_shared/languageInstruction.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chapter detection action
    if (action === "detect-chapters") {
      const { text, filename } = body;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: "You are an expert at analyzing Arabic and Islamic textbook content. Return ONLY valid JSON."
            },
            {
              role: "user",
              content: `From this textbook text (filename: ${filename}), identify the chapter titles and their approximate page numbers. Return JSON:\n{ "chapters": [{"number": 1, "title": "chapter title", "pageApprox": 1}] }\nReturn ONLY the JSON.\n\nText (first 3000 chars):\n${(text || "").substring(0, 3000)}`
            }
          ],
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI detection failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      // Extract JSON
      let chapters = [];
      try {
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          const parsed = JSON.parse(content.slice(start, end + 1));
          chapters = parsed.chapters || [];
        }
      } catch { /* parse error */ }

      return new Response(JSON.stringify({ chapters }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Outline generation action (streaming)
    const { sources, daysOfWeek, startDate, sessionTime, language } = body;
    if (!sources || !sources.length) {
      return new Response(JSON.stringify({ error: "At least one source is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langInstruction = getLanguageInstruction(language);
    const langName = language === "ur" ? "Urdu (اردو script)" : language === "ar" ? "Arabic (عربي script)" : "English";

    // Build combined prompt for all sources
    let sourcesPrompt = "";
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      sourcesPrompt += `\nSource ${i + 1}: ${s.filename}
Total pages: ${s.pageStart || 1} to ${s.pageEnd || s.pageCount} (${s.pageCount} pages)
Detected chapters: ${(s.detectedChapters || []).map((c: any) => typeof c === 'string' ? c : c.title).join(", ") || "None detected"}
Number of teaching days: ${s.numberOfDays}
Duration per day: ${s.durationPerDay}

`;
    }

    const systemPrompt = `${langInstruction}You are an expert Islamic curriculum designer creating a structured day-by-day teaching outline.
You are given one or more books with their page counts and chapter structures.
Distribute the content logically across the given number of days — do NOT split mid-concept unless necessary.
Group related pages that form a complete concept together. Each day should cover a coherent topic.
Return ONLY a raw JSON array — no markdown, no backticks, no preamble.`;

    const userPrompt = `${sourcesPrompt}
Days of week: ${(daysOfWeek || []).join(", ")}
Start date: ${startDate || "Not specified"}
Session time: ${sessionTime || "Not specified"}

Create a day-by-day outline. For each day return:
{
  "dayNumber": number,
  "sourceIndex": number (0-based, which source this day belongs to),
  "sourceFilename": string,
  "chapterNumber": number | null,
  "chapterTitle": string | null,
  "topic": string in ${langName} (concise, max 60 chars),
  "pageStart": number,
  "pageEnd": number,
  "durationMinutes": number,
  "notes": string | null (optional teaching note in ${langName})
}

Rules:
- Do not split a single concept across more than 2 days unless unavoidable.
- Chapter boundaries should align with day breaks where possible.
- If source is in Arabic, topic names should reflect Arabic grammar terminology appropriately.
- Distribute pages proportionally — do not pile up pages at the end.
- For multiple sources, number days sequentially across all sources.

Return ONLY the JSON array.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-outline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
