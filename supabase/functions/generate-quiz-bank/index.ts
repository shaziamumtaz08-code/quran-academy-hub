import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { quiz_bank_id, source_content, language, question_mix, difficulty_level, custom_instructions } = await req.json();

    if (!quiz_bank_id || !source_content) {
      return new Response(JSON.stringify({ error: "quiz_bank_id and source_content required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = language === "ur" ? "Urdu" : language === "ar" ? "Arabic" : "English";
    const mix = Object.entries(question_mix || { mcq: 5, tf: 3, fib: 2 })
      .filter(([_, c]) => (c as number) > 0)
      .map(([t, c]) => `${Math.min((c as number) * 3, 30)} ${t}`)
      .join(", ");

    const diffLabel = difficulty_level === 'mixed' ? 'a mix of easy, medium, and hard' : difficulty_level;

    const systemPrompt = `You are a high-level academic examiner.
Generate a large Question Bank in ${lang} at ${diffLabel} difficulty level.
STRICT RULES:
1. ALL TEXT MUST BE IN ${lang.toUpperCase()} SCRIPT.
2. Provide short explanations for why the correct answer is correct.
3. Each question MUST include a "difficulty" field: "easy", "medium", or "hard".
4. Output raw JSON ONLY. No markdown: { "questions": [{ "text": "", "type": "mcq|tf|fib", "difficulty": "easy|medium|hard", "options": [], "correctIndex": 0, "correctText": "", "explanation": "" }] }
5. For MCQ: 4 options, correctIndex is 0-based.
6. For TF: options should be ["True","False"] or localized equivalents, correctIndex 0 or 1.
7. For FIB: correctText is the answer, no options needed.
8. CRITICAL: Focus ONLY on the EDUCATIONAL SUBJECT MATTER content. COMPLETELY IGNORE any PDF metadata, document artifacts, watermarks (e.g. "Scanned with CamScanner"), page numbers, headers/footers, file format details, scanner app names, or any text related to how the document was created/scanned/digitized. NEVER create questions about the document format, scanning process, or file properties. Only create questions about the actual academic/educational content within the document.`;

    const customBlock = custom_instructions ? `\n\nADDITIONAL INSTRUCTIONS FROM THE ADMIN (follow these strictly):\n${custom_instructions}` : '';
    const userPrompt = `Create a question bank with ${mix} based on the EDUCATIONAL CONTENT below. Ignore any scanner watermarks, PDF artifacts, page numbers, or document metadata — focus only on the subject matter.${customBlock}\n\nCONTENT:\n${source_content.substring(0, 30000)}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI API error: ${errText}`);
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";
    
    let parsed;
    try {
      const clean = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    const questions = parsed.questions || [];

    // Save to DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: updateErr } = await supabase
      .from("quiz_banks")
      .update({ question_bank: questions, source_content: source_content.substring(0, 50000) })
      .eq("id", quiz_bank_id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, count: questions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
