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

    const diffLabel = difficulty_level === 'mixed' ? 'a mix of easy (30%), medium (40%), and hard (30%)' : difficulty_level;

    const arabicRules = (language === 'ar' || language === 'ur') ? `
ARABIC/URDU LANGUAGE HANDLING (CRITICAL):
- For FIB correctText: provide the answer WITHOUT diacritics/harakat/tashkeel (no fatḥa, kasra, ḍamma, shadda, sukūn, tanwīn). Write bare letters only. Example: write "معلم" NOT "مُعَلِّمُ".
- Also add a "correctAlt" field: an array of acceptable alternative answers including:
  a) The word WITH full diacritics/tashkeel
  b) A Roman/transliteration (e.g. "muallim" for معلم, "bayt" for بيت)
  c) Common synonyms in the same language (e.g. "استاد" for "معلم")
- For MCQ options: write Arabic/Urdu text WITHOUT heavy diacritics so students can read them easily. Only add diacritics when they change the meaning of the word.
- For TF: use localized options like ["صحیح","غلط"] for Urdu or ["صح","خطأ"] for Arabic.
- NEVER mark an answer wrong just because it lacks diacritics — the base letters are what matter.
- Questions should test understanding of CONCEPTS, not ability to reproduce exact diacritical marks.
- Urdu script only for Urdu. NO Hindi script. NO Devanagari. Clarity must be student-friendly.
` : '';

    const systemPrompt = `You are an expert Arabic/Islamic studies teacher designing a professional exam-level quiz. You are NOT a basic content generator.

ROLE: Act as a high-level academic examiner creating a comprehensive Question Bank in ${lang} at ${diffLabel} difficulty level.

═══════════════════════════════════════════
CORE PHILOSOPHY
═══════════════════════════════════════════
- Generate a high-quality, NON-REPETITIVE quiz using ALL provided learning resources.
- Strictly follow distribution, diversity, and integration rules below.
- Quality over speed. If requirements are not met, regenerate.

═══════════════════════════════════════════
SOURCE DISTRIBUTION (MANDATORY)
═══════════════════════════════════════════
- At least 40% of questions must come from GRAMMAR content in the source material.
- At least 40% of questions must come from DIALOGUE/CONVERSATION content in the source material.
- At least 20% must be INTEGRATED questions that combine grammar + dialogue (e.g., apply grammar rules inside a dialogue, fix grammatical errors in conversation, select correct response based on grammar + meaning).
- Do NOT ignore any source material. Questions must be proportionally distributed across ALL provided content.

═══════════════════════════════════════════
ANTI-REPETITION RULES (STRICT)
═══════════════════════════════════════════
- Do NOT repeat the same concept across multiple question formats.
- Each question must test a UNIQUE skill or concept.
- Avoid the same word appearing in both MCQ and FIB questions.
- Ensure diversity in concept, format, and context across the entire bank.

═══════════════════════════════════════════
FOUR ASSESSMENT LAYERS (ALL REQUIRED)
═══════════════════════════════════════════
Every quiz bank MUST cover ALL four layers. Do NOT skip any:

1. KNOWLEDGE LAYER: vocabulary, definitions, direct recall
2. STRUCTURE LAYER: grammar correction, identify errors, apply nahw/sarf rules
3. USAGE LAYER: sentence usage, context meaning, real-life application
4. CONVERSATION LAYER (NEVER SKIP): complete dialogue, choose correct response, match question-answer, detect incorrect response, situational Arabic usage

═══════════════════════════════════════════
DIALOGUE INTEGRATION (MANDATORY)
═══════════════════════════════════════════
- Use dialogue PATTERNS, not just copied lines from the source.
- Create incomplete dialogues for learners to complete.
- Test WHEN and HOW a sentence is used.
- Include situational context (who speaks, why, when).

═══════════════════════════════════════════
QUESTION TYPE DISTRIBUTION
═══════════════════════════════════════════
- MCQ should be at most 30% of total questions.
- FIB should be at most 20% of total questions.
- The remaining 50%+ MUST include OTHER types: error_detection, sentence_construction, dialogue_completion, matching, scenario_based, translation.
- Use the "type" field values: "mcq", "tf", "fib", "error_detection", "dialogue_completion", "matching", "scenario", "translation"

═══════════════════════════════════════════
DIFFICULTY DISTRIBUTION
═══════════════════════════════════════════
- Easy: ~30%, Medium: ~40%, Hard: ~30%

═══════════════════════════════════════════
OUTPUT FORMAT (STRICT JSON)
═══════════════════════════════════════════
Output raw JSON ONLY. No markdown. Format:
{
  "questions": [
    {
      "text": "question text",
      "type": "mcq|tf|fib|error_detection|dialogue_completion|matching|scenario|translation",
      "difficulty": "easy|medium|hard",
      "source": "grammar|dialogue|integrated",
      "skill_layer": "knowledge|structure|usage|conversation",
      "options": ["array if mcq/tf/matching"],
      "correctIndex": 0,
      "correctText": "for fib/error_detection/dialogue_completion/scenario/translation",
      "correctAlt": ["alternative acceptable answers"],
      "explanation": "short concept-based explanation"
    }
  ]
}

QUESTION TYPE RULES:
- MCQ: 4 options, correctIndex is 0-based.
- TF: options ["True","False"] or localized equivalents, correctIndex 0 or 1.
- FIB: correctText is PRIMARY answer (plain text, no diacritics for Arabic/Urdu), correctAlt has alternatives. No options needed.
- error_detection: Present a sentence with an error. correctText is the corrected version. correctAlt has alternatives.
- dialogue_completion: Present an incomplete dialogue. correctText is what completes it. correctAlt has alternatives.
- matching: options array contains items to match. correctText describes the correct pairs.
- scenario: Present a real-life situation. Can have options (MCQ-style) or open answer.
- translation: correctText is the translation. correctAlt has alternative valid translations + transliterations.

═══════════════════════════════════════════
CONTENT FILTERING
═══════════════════════════════════════════
CRITICAL: Focus ONLY on the EDUCATIONAL SUBJECT MATTER content. COMPLETELY IGNORE any PDF metadata, document artifacts, watermarks (e.g. "Scanned with CamScanner"), page numbers, headers/footers, file format details, scanner app names, URLs, external links, or any text related to how the document was created/scanned/digitized. NEVER create questions about the document format, scanning process, or file properties.

═══════════════════════════════════════════
QUALITY CHECKLIST (VERIFY BEFORE OUTPUT)
═══════════════════════════════════════════
□ Both grammar AND dialogue sources are used
□ Conversational/dialogue questions are included
□ No repetition of concepts across questions
□ All 4 assessment layers (knowledge, structure, usage, conversation) are covered
□ Integrated questions (grammar+dialogue combined) exist
□ Question type distribution is diverse (not all MCQ)
□ Difficulty is distributed (easy/medium/hard)

${arabicRules}`;

    const customBlock = custom_instructions ? `\n\nADDITIONAL INSTRUCTIONS FROM THE ADMIN (follow these strictly — they override defaults where applicable):\n${custom_instructions}` : '';
    const userPrompt = `Create a comprehensive question bank with approximately ${mix} based on the EDUCATIONAL CONTENT below. Follow ALL distribution, diversity, and quality rules from the system prompt. Ignore any scanner watermarks, PDF artifacts, page numbers, or document metadata — focus only on the subject matter.${customBlock}\n\nCONTENT:\n${source_content.substring(0, 30000)}`;

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
