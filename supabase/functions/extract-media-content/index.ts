import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MediaPart =
  | { kind: "image"; data_url: string }
  | { kind: "audio"; data: string; format: string }
  | { kind: "file"; filename: string; data_url: string };

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

    const { filename, media, instruction } = await req.json() as {
      filename?: string;
      media?: MediaPart[];
      instruction?: string;
    };

    if (!media?.length) {
      return new Response(JSON.stringify({ error: "media required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      const status = res.status === 429 || res.status === 402 ? res.status : 500;
      return new Response(JSON.stringify({ error: `Extraction failed: ${errText.slice(0, 300)}` }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ filename: filename || "media", text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
