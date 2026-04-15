import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function gradeFibAnswersWithAI(fibItems: { question: string; correctAnswer: string; userAnswer: string }[], language: string): Promise<boolean[]> {
  if (fibItems.length === 0) return [];

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return fibItems.map(item => fuzzyMatch(item.userAnswer, item.correctAnswer));
  }

  const lang = language === "ur" ? "Urdu" : language === "ar" ? "Arabic" : "English";

  const prompt = `You are a strict but fair exam grader for ${lang} language quizzes.

Grade the following fill-in-the-blank answers. A student's answer should be marked CORRECT if:
1. It matches the correct answer semantically (same meaning)
2. It is the same word but WITHOUT Arabic diacritics/harakat/tashkeel (e.g., "معلم" = "مُعَلِّمُ")
3. It is a valid Roman/transliteration of the correct answer (e.g., "bayt" for "بَيْتٌ")
4. It is a correct synonym or equivalent term for the concept
5. Minor spelling variations that clearly refer to the same word

Mark INCORRECT only if the answer is genuinely wrong or refers to a different concept.

Questions and answers:
${fibItems.map((item, i) => `${i + 1}. Question: "${item.question}"
   Correct answer: "${item.correctAnswer}"
   Student answer: "${item.userAnswer}"`).join('\n')}

Return ONLY a JSON object with a "results" key containing an array of booleans, one per question. Example: {"results": [true, false, true]}`;

  try {
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      console.error("AI grading failed:", await aiRes.text());
      return fibItems.map(item => fuzzyMatch(item.userAnswer, item.correctAnswer));
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.answers || []);

    if (results.length === fibItems.length) {
      return results.map((r: any) => Boolean(r));
    }
    return fibItems.map(item => fuzzyMatch(item.userAnswer, item.correctAnswer));
  } catch (e) {
    console.error("AI grading error:", e);
    return fibItems.map(item => fuzzyMatch(item.userAnswer, item.correctAnswer));
  }
}

function fuzzyMatch(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer || !correctAnswer) return false;
  const stripDiacritics = (s: string) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");
  const ua = stripDiacritics(userAnswer.toString().toLowerCase().trim());
  const ca = stripDiacritics(correctAnswer.toLowerCase().trim());
  return ua === ca;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { attempt_id, answers, time_taken_seconds } = await req.json();
    if (!attempt_id || !answers) {
      return new Response(JSON.stringify({ error: "attempt_id and answers required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("id", attempt_id)
      .single();

    if (!attempt) {
      return new Response(JSON.stringify({ error: "Attempt not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get language
    const { data: bankData } = await supabase
      .from("quiz_banks")
      .select("language")
      .eq("id", attempt.quiz_bank_id)
      .single();
    const language = (bankData as any)?.language || "en";

    const questions = attempt.questions as any[];
    let score = 0;
    const gradedResults: any[] = [];

    const fibIndices: number[] = [];
    const fibItems: { question: string; correctAnswer: string; userAnswer: string }[] = [];

    questions.forEach((q: any, i: number) => {
      const userAnswer = answers[i];
      if (q.type === "fib" && userAnswer && q.correctText) {
        fibIndices.push(i);
        fibItems.push({ question: q.text, correctAnswer: q.correctText, userAnswer: userAnswer.toString() });
      }
    });

    const fibResults = await gradeFibAnswersWithAI(fibItems, language);

    let fibIdx = 0;
    questions.forEach((q: any, i: number) => {
      const userAnswer = answers[i];
      let correct = false;

      if (q.type === "fib") {
        if (fibIndices.includes(i)) {
          correct = fibResults[fibIdx++];
        }
      } else {
        correct = userAnswer !== undefined && userAnswer === q.correctIndex;
      }

      if (correct) score++;
      gradedResults.push({ ...q, userAnswer, correct });
    });

    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

    await supabase
      .from("quiz_attempts")
      .update({
        answers, score, percentage,
        time_taken_seconds: time_taken_seconds || null,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", attempt_id);

    return new Response(JSON.stringify({ score, max_score: questions.length, percentage, results: gradedResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
