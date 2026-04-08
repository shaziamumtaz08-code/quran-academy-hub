import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseName, subject, level, duration, sessionsPerWeek, targetAudience, learningGoals, sourceText } = await req.json();

    if (!courseName) {
      return new Response(JSON.stringify({ error: "courseName is required" }), {
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

    const durationWeeks = parseInt(duration) || 8;

    const systemPrompt = `You are an expert Islamic education curriculum designer. Create structured, pedagogically sound syllabi for Arabic, Quran, Tajweed, and Islamic Studies courses.

Generate a weekly syllabus as a JSON array. Return ONLY the raw JSON array with no markdown, no backticks, no preamble. Each element:
{
  "week": number,
  "topic": string (concise, max 60 chars),
  "objectives": string (2-3 measurable outcomes, max 120 chars),
  "contentTypes": array of strings from: ["Lesson", "Practice", "Quiz", "Discussion", "Project"]
}`;

    const userPrompt = `Course: ${courseName}
Subject: ${subject || "Not specified"}
Level: ${level || "Not specified"}
Duration: ${duration || "8 weeks"} (${durationWeeks} weeks)
Sessions per week: ${sessionsPerWeek || "2"}
Target audience: ${targetAudience || "Not specified"}
Learning goals: ${learningGoals || "Not specified"}
${sourceText ? `Reference material (extracted from uploaded content — use this to align topics): ${sourceText.substring(0, 3000)}` : ""}

Generate exactly ${durationWeeks} weekly entries covering a logical progression from foundation to mastery. Islamic context should be woven naturally where relevant.`;

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
        max_tokens: 4000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
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
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
