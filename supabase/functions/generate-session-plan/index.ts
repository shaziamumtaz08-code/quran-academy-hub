import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      courseName, subject, level, weekNumber, weekTopic,
      weekObjectives, sessionNumber, sessionDay,
      previousSessionSummary, sessionsPerWeek, sessionDurationMinutes
    } = await req.json();

    if (!courseName || !weekTopic) {
      return new Response(JSON.stringify({ error: "courseName and weekTopic are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duration = sessionDurationMinutes || 45;

    const systemPrompt = `You are an expert Islamic education lesson planner. Create detailed, pedagogically structured session plans following the I-Do/We-Do/You-Do progression. Return ONLY raw JSON, no markdown, no backticks, no preamble.`;

    const userPrompt = `Plan session ${sessionNumber || 1} of week ${weekNumber || 1} for a ${level || 'Intermediate'} ${subject || 'Islamic Studies'} course.
Week topic: ${weekTopic}
Learning objectives: ${weekObjectives || 'Not specified'}
Session focus: ${sessionNumber === 1 ? 'introduce new content' : 'deepen and practise'}
Duration: ${duration} minutes
${previousSessionSummary ? `Previous session covered: ${previousSessionSummary}` : ''}

Return JSON:
{
  "sessionTitle": string,
  "sessionObjective": string (one sentence),
  "totalMinutes": ${duration},
  "activities": [
    {
      "phase": "Opening" | "Input" | "Practice" | "Production" | "Wrap-up",
      "title": string,
      "description": string (teacher instruction, 1-2 sentences),
      "durationMinutes": number,
      "activityType": "teacher-led" | "pair-work" | "group" | "individual" | "quiz" | "discussion",
      "materials": string (optional, what teacher needs)
    }
  ],
  "teacherNotes": string (optional tip, max 100 chars),
  "homeworkSuggestion": string (optional)
}

Include 4-6 activities that fill the full ${duration} minutes. Ensure phases progress logically: Opening → Input → Practice → Production → Wrap-up.`;

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
        max_tokens: 3000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
