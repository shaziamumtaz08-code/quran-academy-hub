import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentType, sessionPlan, courseName, subject, level, questionCount, questionTypes, difficulty, exerciseTypes } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";
    let maxTokens = 4000;

    const activities = sessionPlan?.activities || [];
    const sessionTitle = sessionPlan?.session_title || "Untitled Session";
    const sessionObjective = sessionPlan?.session_objective || "";

    switch (contentType) {
      case "slides": {
        systemPrompt = "You are an educational slide designer for an Islamic academy. Create clean, minimal slide content. Return ONLY a raw JSON array, no markdown, no backticks.";
        userPrompt = `Generate ${activities.length || 6} presentation slides for a ${level || 'Intermediate'} ${subject || 'Arabic'} session titled '${sessionTitle}'.
Activities: ${JSON.stringify(activities)}

For each activity, return one slide:
{
  "activityIndex": number,
  "phase": string,
  "layoutType": "title-bullets" | "arabic-vocab" | "two-column-vocab" | "activity-card",
  "title": string (max 8 words),
  "arabicText": string | null,
  "transliteration": string | null,
  "bullets": string[] (max 4 items, max 12 words each),
  "teacherNote": string | null (max 60 chars),
  "activityInstruction": string | null (for practice slides)
}
Return ONLY the JSON array.`;
        break;
      }

      case "quiz": {
        const qCount = questionCount || 10;
        const qTypes = questionTypes?.join(", ") || "MCQ, Short answer, True/False";
        const diff = difficulty || "Mixed";
        systemPrompt = "You are an Islamic education assessment designer. Create pedagogically sound quiz questions. Return ONLY a raw JSON array, no markdown, no backticks.";
        userPrompt = `Create ${qCount} quiz questions for a ${level || 'Intermediate'} ${subject || 'Arabic'} session on '${sessionTitle}'.
Session objectives: ${sessionObjective}
Activities: ${JSON.stringify(activities.map((a: any) => a.title + ': ' + a.description))}
Question types requested: ${qTypes}
Difficulty: ${diff}

Each question:
{
  "type": "mcq" | "short_answer" | "true_false" | "fill_blank" | "translation",
  "question": string,
  "options": string[] | null (for MCQ, exactly 4),
  "correctAnswer": string,
  "explanation": string (1 sentence why this is correct),
  "difficulty": "easy" | "medium" | "hard",
  "bloomsLevel": "remember" | "understand" | "apply"
}
Return ONLY the JSON array.`;
        break;
      }

      case "flashcards": {
        systemPrompt = "Extract vocabulary and key phrases from this lesson for Arabic language flashcards. Include transliteration. Return ONLY a raw JSON array, no markdown, no backticks.";
        userPrompt = `Generate flashcards for vocabulary in this ${level || 'Intermediate'} Arabic session on '${sessionTitle}'.
Session activities: ${JSON.stringify(activities.map((a: any) => a.title + ': ' + a.description))}

Each flashcard:
{
  "arabic": string (the Arabic word or phrase),
  "english": string (English meaning),
  "transliteration": string (romanised pronunciation),
  "partOfSpeech": "noun"|"verb"|"phrase"|"expression",
  "exampleSentence": string | null (Arabic example),
  "exampleTranslation": string | null
}
Include 10-15 cards covering all key vocabulary. Return ONLY the JSON array.`;
        maxTokens = 3000;
        break;
      }

      case "worksheet": {
        const exTypes = exerciseTypes?.join(", ") || "fill_blank, translate_to_arabic, match, short_answer";
        systemPrompt = "You are a worksheet designer for Islamic education. Create printable exercises. Return ONLY raw JSON, no markdown, no backticks.";
        userPrompt = `Create a printable worksheet for ${level || 'Intermediate'} ${subject || 'Arabic'} students on '${sessionTitle}'.
Objectives: ${sessionObjective}
Activities: ${JSON.stringify(activities.map((a: any) => a.title + ': ' + a.description))}
Include exercises: ${exTypes}

Return JSON:
{
  "title": string,
  "exercises": [
    {
      "type": "fill_blank"|"translate_to_arabic"|"match"|"short_answer",
      "title": string,
      "instructions": string,
      "items": [
        {
          "question": string,
          "answer": string,
          "blankedSentence": string | null
        }
      ]
    }
  ]
}`;
        maxTokens = 3000;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid contentType" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
