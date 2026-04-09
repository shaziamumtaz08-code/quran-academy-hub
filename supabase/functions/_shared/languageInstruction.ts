/**
 * Returns a language instruction to prepend to AI system prompts.
 * Only the CONTENT (titles, bullets, questions, answers, explanations) should
 * be in the target language. All JSON keys, enum values, structural labels
 * (phase names, layoutType, difficulty, bloomsLevel, type, partOfSpeech)
 * and UI metadata MUST remain in English.
 */
export function getLanguageInstruction(language: string | undefined): string {
  if (language === 'ur') return `
LANGUAGE REQUIREMENT — MANDATORY:
Write all CONTENT fields (titles, bullets, questions, answers, explanations, descriptions, instructions, example sentences) in clear, simple Pakistani Urdu (اردو). Use everyday Urdu vocabulary that a teacher with a Pakistani madrasa background would understand. Do NOT use English words unless they are proper nouns or technical terms with no Urdu equivalent. Do NOT transliterate — write in proper Urdu script.
IMPORTANT: All JSON keys, enum values, and structural fields (phase, layoutType, type, difficulty, bloomsLevel, partOfSpeech) MUST remain in English exactly as specified. Only the human-readable content should be in Urdu.
When you need to write an Arabic word being taught (Quran/hadith vocabulary), write it directly in Arabic script without any wrapper tags.

`;

  if (language === 'ar') return `
LANGUAGE REQUIREMENT — MANDATORY:
Write all CONTENT fields (titles, bullets, questions, answers, explanations, descriptions, instructions, example sentences) in clear, simple Modern Standard Arabic (فصحى). Use vocabulary appropriate for an Islamic education teacher. Keep sentences short. Do NOT use English unless it is a proper noun. Write in proper Arabic script, right-to-left.
IMPORTANT: All JSON keys, enum values, and structural fields (phase, layoutType, type, difficulty, bloomsLevel, partOfSpeech) MUST remain in English exactly as specified. Only the human-readable content should be in Arabic.

`;

  return 'Write all generated content text in clear English.\n\n';
}
