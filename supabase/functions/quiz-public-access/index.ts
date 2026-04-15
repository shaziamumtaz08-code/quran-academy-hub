import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function gradeFibAnswersWithAI(fibItems: { question: string; correctAnswer: string; alternatives: string[]; userAnswer: string }[], language: string): Promise<boolean[]> {
  if (fibItems.length === 0) return [];

  // First try local matching (fast, no AI cost)
  const localResults = fibItems.map(item => fuzzyMatchWithAlts(item.userAnswer, item.correctAnswer, item.alternatives));
  // If all matched locally, skip AI
  if (localResults.every(r => r)) return localResults;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return localResults;
  }

  // Only send items that failed local matching to AI
  const aiNeededIndices: number[] = [];
  const aiItems: typeof fibItems = [];
  localResults.forEach((matched, i) => {
    if (!matched) {
      aiNeededIndices.push(i);
      aiItems.push(fibItems[i]);
    }
  });

  const lang = language === "ur" ? "Urdu" : language === "ar" ? "Arabic" : "English";

  const prompt = `You are a strict but fair exam grader for ${lang} language quizzes.

Grade the following fill-in-the-blank answers. A student's answer should be marked CORRECT if:
1. It matches the correct answer semantically (same meaning)
2. It is the same word but WITHOUT Arabic diacritics/harakat/tashkeel (e.g., "معلم" = "مُعَلِّمُ")
3. It is a valid Roman/transliteration of the correct answer (e.g., "bayt" for "بَيْتٌ", "muallim" for "معلم")
4. It is a correct synonym or equivalent term for the concept (e.g., "استاد" for "معلم")
5. Minor spelling variations that clearly refer to the same word
6. The answer captures the same concept even if phrased differently

Mark INCORRECT only if the answer is genuinely wrong or refers to a different concept.

Questions and answers:
${aiItems.map((item, i) => `${i + 1}. Question: "${item.question}"
   Correct answer: "${item.correctAnswer}"${item.alternatives.length > 0 ? `\n   Also acceptable: ${item.alternatives.join(', ')}` : ''}
   Student answer: "${item.userAnswer}"`).join('\n')}

Return ONLY a JSON array of booleans, one per question. Example: [true, false, true]
No explanation needed.`;

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
      return localResults;
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "[]";
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    const aiResults = Array.isArray(parsed) ? parsed : (parsed.results || parsed.answers || []);

    if (aiResults.length === aiItems.length) {
      const finalResults = [...localResults];
      aiNeededIndices.forEach((origIdx, aiIdx) => {
        finalResults[origIdx] = Boolean(aiResults[aiIdx]);
      });
      return finalResults;
    }

    return localResults;
  } catch (e) {
    console.error("AI grading error:", e);
    return localResults;
  }
}

function fuzzyMatch(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer || !correctAnswer) return false;
  const stripDiacritics = (s: string) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");
  const ua = stripDiacritics(userAnswer.toString().toLowerCase().trim());
  const ca = stripDiacritics(correctAnswer.toLowerCase().trim());
  return ua === ca;
}

function fuzzyMatchWithAlts(userAnswer: string, correctAnswer: string, alternatives: string[]): boolean {
  if (!userAnswer) return false;
  if (fuzzyMatch(userAnswer, correctAnswer)) return true;
  return alternatives.some(alt => fuzzyMatch(userAnswer, alt));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "load") {
      const token = url.searchParams.get("token");
      if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: session, error: sErr } = await supabase
        .from("quiz_sessions")
        .select("*, quiz_bank:quiz_banks!quiz_sessions_quiz_bank_id_fkey(id, name, description, language, questions_per_attempt, time_limit_minutes, max_attempts, passing_percentage, question_bank, mode)")
        .eq("access_token", token)
        .eq("status", "live")
        .single();

      if (sErr || !session) {
        return new Response(JSON.stringify({ error: "Quiz not found or not active" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const bank = session.quiz_bank as any;
      const totalQuestions = bank?.question_bank?.length || 0;

      return new Response(JSON.stringify({
        session_id: session.id,
        title: session.title || bank?.name,
        description: bank?.description,
        language: bank?.language,
        questions_per_attempt: bank?.questions_per_attempt,
        time_limit_minutes: bank?.time_limit_minutes,
        max_attempts: bank?.max_attempts,
        passing_percentage: bank?.passing_percentage,
        total_questions: totalQuestions,
        mode: bank?.mode,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST" && action === "start") {
      const { token, guest_email, guest_name } = await req.json();
      if (!token || !guest_email) {
        return new Response(JSON.stringify({ error: "token and guest_email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: session } = await supabase
        .from("quiz_sessions")
        .select("id, quiz_bank_id, quiz_bank:quiz_banks!quiz_sessions_quiz_bank_id_fkey(question_bank, questions_per_attempt, max_attempts, language)")
        .eq("access_token", token)
        .eq("status", "live")
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: "Quiz not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const bank = session.quiz_bank as any;

      const { count } = await supabase
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("guest_email", guest_email.toLowerCase().trim());

      if (bank.max_attempts && (count || 0) >= bank.max_attempts) {
        return new Response(JSON.stringify({ error: "Maximum attempts reached" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const allQ = bank.question_bank || [];
      const numQ = Math.min(bank.questions_per_attempt || 10, allQ.length);
      const shuffled = [...allQ].sort(() => Math.random() - 0.5).slice(0, numQ);

      const shuffledWithOptions = shuffled.map((q: any) => {
        if (q.type === 'fib' || !q.options || q.options.length === 0) return { ...q };
        const indices = q.options.map((_: any, i: number) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const newOptions = indices.map((idx: number) => q.options[idx]);
        const newCorrectIndex = indices.indexOf(q.correctIndex);
        return { ...q, options: newOptions, correctIndex: newCorrectIndex };
      });

      const clientQuestions = shuffledWithOptions.map((q: any, i: number) => ({
        index: i, text: q.text, type: q.type, options: q.options || [],
      }));

      const { data: attempt, error: aErr } = await supabase
        .from("quiz_attempts")
        .insert({
          session_id: session.id,
          quiz_bank_id: session.quiz_bank_id,
          guest_email: guest_email.toLowerCase().trim(),
          guest_name: guest_name || null,
          questions: shuffledWithOptions,
          max_score: numQ,
          status: "in_progress",
        })
        .select("id")
        .single();

      if (aErr) throw aErr;

      return new Response(JSON.stringify({
        attempt_id: attempt.id,
        questions: clientQuestions,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST" && action === "submit") {
      const { attempt_id, answers, time_taken_seconds } = await req.json();
      if (!attempt_id || !answers) {
        return new Response(JSON.stringify({ error: "attempt_id and answers required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: attempt } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("id", attempt_id)
        .eq("status", "in_progress")
        .single();

      if (!attempt) {
        return new Response(JSON.stringify({ error: "Attempt not found or already submitted" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get language from quiz bank
      const { data: bankData } = await supabase
        .from("quiz_banks")
        .select("language")
        .eq("id", attempt.quiz_bank_id)
        .single();
      const language = (bankData as any)?.language || "en";

      const questions = attempt.questions as any[];
      let score = 0;
      const gradedResults: any[] = [];

      // Separate FIB questions for AI grading
      const fibIndices: number[] = [];
      const fibItems: { question: string; correctAnswer: string; alternatives: string[]; userAnswer: string }[] = [];

      questions.forEach((q: any, i: number) => {
        const userAnswer = answers[i];
        if (q.type === "fib" && userAnswer && q.correctText) {
          fibIndices.push(i);
          fibItems.push({ question: q.text, correctAnswer: q.correctText, alternatives: q.correctAlt || [], userAnswer: userAnswer.toString() });
        }
      });

      // AI-grade FIB answers
      const fibResults = await gradeFibAnswersWithAI(fibItems, language);

      // Build final results
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

      const { error: upErr } = await supabase
        .from("quiz_attempts")
        .update({
          answers, score, percentage,
          time_taken_seconds: time_taken_seconds || null,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", attempt_id);

      if (upErr) throw upErr;

      return new Response(JSON.stringify({
        score, max_score: questions.length, percentage, results: gradedResults,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
