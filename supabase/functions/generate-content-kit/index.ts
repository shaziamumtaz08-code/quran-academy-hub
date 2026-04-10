import { corsHeaders } from "../_shared/cors.ts";
import { getLanguageInstruction } from "../_shared/languageInstruction.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentType, sessionPlan, courseName, subject, level, questionCount, questionTypes, difficulty, exerciseTypes, language, customPrompt, stylePrompt } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langInstruction = getLanguageInstruction(language);
    let systemPrompt = "";
    let userPrompt = "";
    let maxTokens = 4000;

    const activities = sessionPlan?.activities || [];
    const customSpec = customPrompt ? `\n\nAdditional instructor specifications: ${customPrompt}` : "";
    const styleSpec = stylePrompt ? `\n\nStyle & tone guidance from the teacher: ${stylePrompt}. Adapt your language tone, formality level, and content style accordingly.` : "";
    const sessionTitle = sessionPlan?.session_title || "Untitled Session";
    const sessionObjective = sessionPlan?.session_objective || "";

    switch (contentType) {
      case "slides": {
        systemPrompt = `${langInstruction}You are a PROFESSIONAL educational slide designer creating premium presentation content for an Islamic academy. Your slides should be rich, detailed, and pedagogically excellent — NOT basic bullet points. Include real teaching content: vocabulary with diacritics, example sentences, guided practice prompts, discussion questions. Every slide must feel like it was crafted by an expert curriculum designer. Return ONLY a raw JSON array. NEVER wrap in markdown code blocks. NEVER use backticks. Do NOT include [ARABIC] tags — just write Arabic text directly in Arabic script.`;
        userPrompt = `Generate ${activities.length || 6} DETAILED presentation slides for a ${level || 'Intermediate'} ${subject || 'Arabic'} session titled '${sessionTitle}'.
Session objective: ${sessionObjective}
Activities: ${JSON.stringify(activities)}

IMPORTANT GUIDELINES:
- Opening slides: include an engaging hook question or warm-up prompt
- Vocabulary slides: include Arabic words WITH full diacritics (tashkeel), transliteration, AND example usage in a sentence
- Teaching slides: include clear explanations, examples, and key takeaways — NOT generic placeholders
- Practice slides: include specific student activities with clear instructions
- Wrap-up slides: include review questions and homework/next-steps

For each activity, return one slide:
{
  "activityIndex": number,
  "phase": string (one of: "Opening", "Input", "Practice", "Production", "Wrap-up", "Quiz"),
  "layoutType": "title-bullets" | "arabic-vocab" | "two-column-vocab" | "activity-card",
  "title": string (max 8 words, descriptive and engaging),
  "arabicText": string | null (include Arabic with diacritics where relevant),
  "transliteration": string | null (romanised pronunciation),
  "bullets": string[] (3-5 items, each 8-15 words with REAL content, not placeholders),
  "teacherNote": string | null (practical tip for the teacher, max 80 chars),
  "activityInstruction": string | null (specific student activity instruction for practice/production slides)
}
Return ONLY the JSON array.${customSpec}${styleSpec}`;
        break;
      }

      case "quiz": {
        const qCount = questionCount || 10;
        const qTypes = questionTypes?.join(", ") || "MCQ, Short answer, True/False";
        const diff = difficulty || "Mixed";
        systemPrompt = `${langInstruction}You are an Islamic education assessment designer. Create pedagogically sound quiz questions. Return ONLY a raw JSON array. NEVER wrap in markdown code blocks. NEVER use backticks. Do NOT include [ARABIC] tags — just write Arabic text directly.`;
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
Return ONLY the JSON array.${customSpec}${styleSpec}`;
        break;
      }

      case "flashcards": {
        systemPrompt = `${langInstruction}You are a PROFESSIONAL Arabic language vocabulary specialist. Create rich, detailed flashcards with full diacritics (tashkeel/harakat) on all Arabic text. Every card must include a practical example sentence showing the word in context. Return ONLY a raw JSON array. NEVER wrap in markdown code blocks. NEVER use backticks. Do NOT include [ARABIC] tags — just write Arabic text directly in Arabic script with diacritics.`;
        userPrompt = `Generate professional flashcards for vocabulary in this ${level || 'Intermediate'} Arabic session on '${sessionTitle}'.
Session objective: ${sessionObjective}
Session activities: ${JSON.stringify(activities.map((a: any) => a.title + ': ' + a.description))}

IMPORTANT: 
- Write ALL Arabic text with FULL diacritics/tashkeel (فَتْحَة، ضَمَّة، كَسْرَة، سُكُون، شَدَّة، تَنْوِين)
- Include a REAL example sentence for EVERY card (not null)
- Group related vocabulary together
- Include root letters for verbs where helpful

Each flashcard:
{
  "arabic": string (Arabic word/phrase WITH full diacritics),
  "english": string (clear English meaning with context),
  "transliteration": string (accurate romanised pronunciation),
  "partOfSpeech": "noun"|"verb"|"phrase"|"expression"|"adjective"|"preposition",
  "exampleSentence": string (Arabic example sentence with diacritics showing the word in context),
  "exampleTranslation": string (English translation of the example)
}
Include 12-15 cards covering all key vocabulary from the session. Return ONLY the JSON array.${customSpec}${styleSpec}`;
        maxTokens = 4000;
        break;
      }

      case "worksheet": {
        const exTypes = exerciseTypes?.join(", ") || "fill_blank, translate_to_arabic, match, short_answer";
        systemPrompt = `${langInstruction}You are a worksheet designer for Islamic education. Create printable exercises. Return ONLY raw JSON. NEVER wrap in markdown code blocks. NEVER use backticks. Do NOT include [ARABIC] tags — just write Arabic text directly.`;
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
}${customSpec}${styleSpec}`;
        maxTokens = 3000;
        break;
      }

      case "infographic": {
        systemPrompt = `${langInstruction}You are an expert educational infographic designer for Islamic academies. Create structured infographic content with clear sections, key stats/facts, visual flow, and concise labels. Return ONLY raw JSON. NEVER wrap in markdown code blocks. Do NOT include [ARABIC] tags — just write Arabic text directly in Arabic script with diacritics.`;
        userPrompt = `Create a detailed infographic layout for a ${level || 'Intermediate'} ${subject || 'Arabic'} session titled '${sessionTitle}'.
Session objective: ${sessionObjective}
Activities: ${JSON.stringify(activities.map((a: any) => a.title + ': ' + a.description))}

The infographic should visually summarize the key concepts from this lesson.

Return JSON:
{
  "title": string (catchy infographic title, max 10 words),
  "subtitle": string (one-liner summary),
  "sections": [
    {
      "heading": string (section label, 2-4 words),
      "icon": string (emoji representing this section),
      "points": string[] (2-4 concise bullet points, each max 12 words),
      "highlight": string | null (a key stat, fact, or Arabic term to emphasize)
    }
  ],
  "centerFact": string (one big takeaway fact or stat for the center/hero area),
  "footer": string (a motivational or summary line for the bottom)
}
Include 4-6 sections. Make it visually rich with real content from the session.${customSpec}${styleSpec}`;
        maxTokens = 3000;
        break;
      }

      case "mindmap": {
        systemPrompt = `${langInstruction}You are an expert mind map designer for Islamic education. Create hierarchical mind map structures that help students visualize relationships between concepts. Return ONLY raw JSON. NEVER wrap in markdown code blocks. Do NOT include [ARABIC] tags — just write Arabic text directly in Arabic script.`;
        userPrompt = `Create a comprehensive mind map for a ${level || 'Intermediate'} ${subject || 'Arabic'} session titled '${sessionTitle}'.
Session objective: ${sessionObjective}
Activities: ${JSON.stringify(activities.map((a: any) => a.title + ': ' + a.description))}

The mind map should break down the session topic into a hierarchical structure.

Return JSON:
{
  "centralTopic": string (main topic in the center, 2-5 words),
  "branches": [
    {
      "label": string (branch label, 2-4 words),
      "color": string (hex color for this branch, e.g. "#4a90d9"),
      "children": [
        {
          "label": string (sub-topic, 2-6 words),
          "detail": string | null (optional extra detail or Arabic term),
          "children": [
            {
              "label": string (leaf node, 2-6 words),
              "detail": string | null
            }
          ]
        }
      ]
    }
  ]
}
Include 4-6 main branches, each with 2-4 children. Some children should have their own sub-children for depth.${customSpec}${styleSpec}`;
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
        stream: false,
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

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";
    console.log("Raw AI content (first 300):", rawContent.slice(0, 300));

    // Extract JSON from response, stripping markdown fences and tags
    let cleaned = rawContent
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/\[ARABIC\]\s*([\s\S]*?)\s*\[\/ARABIC\]/gi, "$1")
      .replace(/\[\/?ARABIC\]/gi, "")
      .trim();

    const jsonStart = cleaned.search(/[\{\[]/);
    const lastBracket = cleaned.lastIndexOf("]");
    const lastBrace = cleaned.lastIndexOf("}");
    const jsonEnd = Math.max(lastBracket, lastBrace);

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("No JSON found in AI response:", rawContent.slice(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return valid JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse failed:", e.message, "Cleaned (first 500):", cleaned.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response as JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
