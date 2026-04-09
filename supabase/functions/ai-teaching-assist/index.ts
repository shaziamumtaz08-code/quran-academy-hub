import { corsHeaders } from "../_shared/cors.ts";
import { getLanguageInstruction } from "../_shared/languageInstruction.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assistType, activityTitle, activityDesc, subject, level, courseName, userMessage, language } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langInstruction = getLanguageInstruction(language);
    let systemPrompt = "";
    let userPrompt = "";
    let maxTokens = 300;

    switch (assistType) {
      case "drill":
        systemPrompt = `${langInstruction}You are an expert classroom activity designer for Islamic education.`;
        userPrompt = `Suggest one 3-minute classroom drill for a ${level || 'Intermediate'} ${subject || 'Arabic'} class on '${activityTitle}'. The drill should require zero materials and work in a live online class. Format: [Drill name]: [2-sentence teacher instruction].`;
        maxTokens = 200;
        break;

      case "rephrase":
        systemPrompt = `${langInstruction}You are a teaching assistant helping explain concepts in simpler ways.`;
        userPrompt = `A teacher just explained: '${activityDesc}'. Some students didn't understand. Give one alternative explanation using a different analogy or approach. Keep it under 80 words.`;
        maxTokens = 200;
        break;

      case "comprehension":
        systemPrompt = `${langInstruction}You are an assessment designer for Islamic education classes.`;
        userPrompt = `Give 3 quick verbal comprehension check questions for '${activityTitle}'. Questions should be answerable in one sentence. Label them Easy / Medium / Hard.`;
        maxTokens = 200;
        break;

      case "assistant":
      default:
        systemPrompt = `${langInstruction}You are an assistant for a teacher currently running a live ${subject || 'Islamic Studies'} class at ${level || 'Intermediate'} level. Current activity: ${activityTitle}. Description: ${activityDesc || 'N/A'}. Course: ${courseName || 'N/A'}. Provide brief, immediately actionable teaching suggestions. Maximum 150 words.`;
        userPrompt = userMessage || "Give me a quick teaching tip for this activity.";
        maxTokens = 300;
        break;
    }

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
        max_tokens: maxTokens,
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
