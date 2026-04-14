import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "load") {
      // Load quiz session by access_token
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

      // Don't send full question bank to client - just metadata
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
      // Start a public attempt
      const { token, guest_email, guest_name } = await req.json();
      if (!token || !guest_email) {
        return new Response(JSON.stringify({ error: "token and guest_email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: session } = await supabase
        .from("quiz_sessions")
        .select("id, quiz_bank_id, quiz_bank:quiz_banks!quiz_sessions_quiz_bank_id_fkey(question_bank, questions_per_attempt, max_attempts)")
        .eq("access_token", token)
        .eq("status", "live")
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: "Quiz not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const bank = session.quiz_bank as any;

      // Check max attempts for this email
      const { count } = await supabase
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("guest_email", guest_email.toLowerCase().trim());

      if (bank.max_attempts && (count || 0) >= bank.max_attempts) {
        return new Response(JSON.stringify({ error: "Maximum attempts reached" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Randomly select questions
      const allQ = bank.question_bank || [];
      const numQ = Math.min(bank.questions_per_attempt || 10, allQ.length);
      const shuffled = [...allQ].sort(() => Math.random() - 0.5).slice(0, numQ);

      // Shuffle options for MCQ/TF so correct answer isn't always "A"
      const shuffledWithOptions = shuffled.map((q: any) => {
        if (q.type === 'fib' || !q.options || q.options.length === 0) return { ...q };
        
        // Create index mapping and shuffle
        const indices = q.options.map((_: any, i: number) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        const newOptions = indices.map((idx: number) => q.options[idx]);
        const newCorrectIndex = indices.indexOf(q.correctIndex);
        
        return { ...q, options: newOptions, correctIndex: newCorrectIndex };
      });

      // Remove correct answers from what we send to client
      const clientQuestions = shuffledWithOptions.map((q: any, i: number) => ({
        index: i,
        text: q.text,
        type: q.type,
        options: q.options || [],
      }));

      // Create attempt record (store full questions with answers server-side)
      const { data: attempt, error: aErr } = await supabase
        .from("quiz_attempts")
        .insert({
          session_id: session.id,
          quiz_bank_id: session.quiz_bank_id,
          guest_email: guest_email.toLowerCase().trim(),
          guest_name: guest_name || null,
          questions: shuffled, // full questions with answers (server side)
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
      // Submit answers for a public attempt
      const { attempt_id, answers, time_taken_seconds } = await req.json();
      if (!attempt_id || !answers) {
        return new Response(JSON.stringify({ error: "attempt_id and answers required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get the attempt with full questions
      const { data: attempt } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("id", attempt_id)
        .eq("status", "in_progress")
        .single();

      if (!attempt) {
        return new Response(JSON.stringify({ error: "Attempt not found or already submitted" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Grade
      const questions = attempt.questions as any[];
      let score = 0;
      const gradedResults: any[] = [];

      questions.forEach((q: any, i: number) => {
        const userAnswer = answers[i];
        let correct = false;

        if (q.type === "fib") {
          correct = userAnswer && q.correctText &&
            userAnswer.toString().toLowerCase().trim() === q.correctText.toLowerCase().trim();
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
          answers,
          score,
          percentage,
          time_taken_seconds: time_taken_seconds || null,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", attempt_id);

      if (upErr) throw upErr;

      return new Response(JSON.stringify({
        score,
        max_score: questions.length,
        percentage,
        results: gradedResults,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
