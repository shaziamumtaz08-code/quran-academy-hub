import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { studentName, courseName, language, assessmentAvg, attendanceRate, speakingAvg, assignmentCompletion, vocabMastered, weakestSkill, teacherNote, atRisk } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const langInstruction = language === 'ur'
      ? 'Write this report entirely in clear, simple Pakistani Urdu. Use common Urdu words, not overly formal. This is for a parent.'
      : language === 'ar'
      ? 'Write this report entirely in simple Modern Standard Arabic. This is for a parent.'
      : '';

    const systemPrompt = `You are writing a monthly student progress report FOR PARENTS — not teachers. Use plain, warm, encouraging language. Avoid technical jargon. Keep sentences short. Write as if speaking to a caring parent who is not an educator. ${langInstruction}`;

    const userPrompt = `Write a parent-facing monthly report for ${studentName} in ${courseName}.

Data:
- Assessment average: ${assessmentAvg}%
- Attendance: ${attendanceRate}%
- Speaking pronunciation avg: ${speakingAvg}%
- Assignment completion: ${assignmentCompletion}
- Vocabulary mastered: ${vocabMastered}
- Weakest skill: ${weakestSkill}
- Teacher note this month: ${teacherNote}
- At-risk: ${atRisk}

Return JSON:
{
  "summary": "3 sentences",
  "learningUpdate": "2 sentences: covered + upcoming",
  "needsSupport": "2 sentences if issues, or null",
  "homeSuggestions": ["2-3 simple actions"],
  "badges": ["1-3 achievement labels"],
  "overallTone": "positive|cautionary|urgent"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "parent_report",
            description: "Return structured parent report",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                learningUpdate: { type: "string" },
                needsSupport: { type: "string" },
                homeSuggestions: { type: "array", items: { type: "string" } },
                badges: { type: "array", items: { type: "string" } },
                overallTone: { type: "string", enum: ["positive", "cautionary", "urgent"] },
              },
              required: ["summary", "learningUpdate", "homeSuggestions", "badges", "overallTone"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "parent_report" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const report = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(report || {}), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-parent-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
