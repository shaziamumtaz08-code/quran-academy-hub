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
        systemPrompt = `${langInstruction}You are a world-class educational content designer with 15 years of experience creating premium teaching materials for language academies. Your slides are used by thousands of teachers globally.

QUALITY STANDARDS:
- Every slide must contain REAL teaching content — never placeholders or generic filler
- Arabic text MUST have complete tashkeel/diacritics on every letter
- Vocabulary items must include root letters, morphological pattern, and contextual usage
- Example sentences must be natural, practical, and at the appropriate difficulty level
- Grammar explanations must use clear analogies and progressive disclosure
- Practice prompts must be specific and actionable — "Practice with your partner" is NOT acceptable, instead: "Student A points to 3 objects and asks 'مَا هَذَا؟' — Student B answers with the correct Arabic name"
- Teacher notes must be specific pedagogical guidance, not generic advice

CONTENT DEPTH:
- Opening: hook question that connects to students' real life + brief review of last session's key point
- Input: structured explanation with minimum 2 examples per concept, building from simple to complex
- Practice: specific pair/group activity with exact dialogue scripts students should practice
- Production: creative task where students apply the concept independently
- Wrap-up: 3 specific review questions testing the lesson's objectives + preview of next session

Return ONLY a raw JSON array. No markdown, no backticks, no [ARABIC] tags.`;

        userPrompt = `Generate ${Math.max(activities.length, 6)} PREMIUM presentation slides for:
Course: ${courseName || 'Arabic Language Course'}
Level: ${level || 'Beginner'}
Subject: ${subject || 'Arabic Language'}
Session: ${sessionTitle}
Objective: ${sessionObjective}

Session activities with full details:
${activities.map((a: any, i: number) => `Activity ${i+1} [${a.phase}]: ${a.title}
Duration: ${a.durationMinutes} min
Description: ${a.description}
Type: ${a.activityType || 'teacher-led'}
Materials: ${a.materials || 'none specified'}`).join('\n\n')}

For EACH activity generate a slide with:
{
  "activityIndex": number,
  "phase": "Opening" | "Input" | "Practice" | "Production" | "Wrap-up" | "Quiz",
  "layoutType": "title-bullets" | "arabic-vocab" | "two-column-vocab" | "activity-card" | "dialogue-practice" | "grammar-table" | "visual-prompt",
  "title": string (compelling, max 8 words — NOT generic like "Let's Learn" — specific like "Near & Far: هَذَا vs ذَلِكَ"),
  "arabicText": string | null (Arabic with FULL diacritics — فَتْحَة ضَمَّة كَسْرَة سُكُون شَدَّة تَنْوِين on EVERY letter),
  "transliteration": string | null (accurate romanized pronunciation),
  "bullets": string[] (4-6 items, each 10-20 words with SUBSTANTIVE content — real vocabulary, real examples, real instructions),
  "teacherNote": string (specific classroom management tip for THIS activity, max 100 chars),
  "activityInstruction": string | null (for practice/production: exact step-by-step activity instructions with example dialogue),
  "grammarTable": { "headers": string[], "rows": string[][] } | null (for grammar explanation slides),
  "vocabularyItems": [{ "arabic": string, "transliteration": string, "english": string, "example": string }] | null (for vocab-heavy slides)
}

CRITICAL: Do NOT produce generic content. Every bullet must contain real teaching material specific to ${subject} at ${level} level.
Return ONLY the JSON array.${customSpec}${styleSpec}`;
        maxTokens = 6000;
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
        userPrompt = `Generate 15-20 professional flashcards for vocabulary in this ${level || 'Intermediate'} ${subject || 'Arabic'} session on '${sessionTitle}'.

Session objective: ${sessionObjective}
Activities: ${JSON.stringify(activities.map((a: any) => ({ title: a.title, description: a.description })))}

QUALITY REQUIREMENTS:
- EVERY Arabic word must have COMPLETE diacritics (not just the first letter — EVERY letter)
- Include morphological information: root letters (جذر), verb pattern (وزن) where applicable
- Example sentences must be natural conversational Arabic, not textbook stilted
- Group vocabulary by semantic category (greetings, objects, actions, etc.)
- Include common collocations or phrases where the word frequently appears
- For verbs: include present and past tense forms

Each flashcard:
{
  "arabic": string (with FULL diacritics on every letter),
  "english": string (clear meaning with usage context in parentheses),
  "transliteration": string (accurate IPA-like romanization),
  "partOfSpeech": "noun" | "verb" | "phrase" | "expression" | "adjective" | "preposition" | "particle",
  "exampleSentence": string (natural Arabic sentence with full diacritics, 5-10 words),
  "exampleTranslation": string (natural English translation),
  "rootLetters": string | null (e.g., "ك-ت-ب" for كِتَاب),
  "category": string (semantic group: "greetings", "classroom", "food", "family", etc.),
  "usageNote": string | null (brief note on when/how to use this word naturally)
}

Return ONLY the JSON array.${customSpec}${styleSpec}`;
        maxTokens = 5000;
        break;
      }

      case "worksheet": {
        const exTypes = exerciseTypes?.join(", ") || "fill_blank, translate_to_arabic, match, short_answer, sentence_construction, dialogue_completion";
        systemPrompt = `${langInstruction}You are a worksheet designer for Islamic education. Create printable exercises with rich content. Return ONLY raw JSON. NEVER wrap in markdown code blocks. NEVER use backticks. Do NOT include [ARABIC] tags — just write Arabic text directly.`;
        userPrompt = `Create a comprehensive, printable worksheet for ${level || 'Intermediate'} ${subject || 'Arabic'} students on '${sessionTitle}'.
Objectives: ${sessionObjective}
Activities: ${JSON.stringify(activities.map((a: any) => a.title + ': ' + a.description))}

EXERCISE TYPES — include at least 4 of these: ${exTypes}
Additional types to consider:
1. Fill in the blanks (with Arabic diacritics in the sentence)
2. Translation (both directions: Arabic→English AND English→Arabic)
3. Matching (Arabic words to English meanings)
4. Sentence construction (given words, build a correct sentence)
5. Reading comprehension (short Arabic paragraph + questions)
6. Dialogue completion (fill missing lines in a conversation)
7. Error correction (find and fix mistakes in Arabic sentences)
8. Short answer

Each exercise should have 4-6 items minimum.

Return JSON:
{
  "title": string,
  "exercises": [
    {
      "type": string,
      "title": string,
      "instructions": string (clear instructions),
      "items": [
        {
          "question": string,
          "answer": string,
          "blankedSentence": string | null,
          "options": string[] | null (for matching exercises)
        }
      ]
    }
  ]
}${customSpec}${styleSpec}`;
        maxTokens = 5000;
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
