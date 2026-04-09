/**
 * Language instruction injected into AI system prompts.
 * Used by all Teaching OS edge functions.
 */
export function getLanguageInstruction(language: string | undefined): string {
  if (language === 'ur') return `
LANGUAGE REQUIREMENT — MANDATORY:
Write ALL generated text in clear, simple Pakistani Urdu (اردو). Use everyday Urdu vocabulary that a teacher with a Pakistani madrasa background would understand. Do NOT use English words unless they are proper nouns or technical terms with no Urdu equivalent. Do NOT transliterate — write in proper Urdu script. Sentence structure should be natural Urdu, not translated English.
When you need to write an Arabic word being taught (Quran/hadith vocabulary), wrap it in [ARABIC]word[/ARABIC] tags. Example: [ARABIC]هذا[/ARABIC] کا مطلب یہ ہے۔
`;

  if (language === 'ar') return `
LANGUAGE REQUIREMENT — MANDATORY:
Write ALL generated text in clear, simple Modern Standard Arabic (فصحى). Use vocabulary appropriate for an Islamic education teacher. Keep sentences short. Do NOT use English unless it is a proper noun. Write in proper Arabic script, right-to-left.
`;

  return 'Write all generated text in clear English.';
}

/**
 * Parse [ARABIC]...[/ARABIC] tags into HTML spans for rendering.
 */
export function parseArabicTags(text: string): string {
  return text
    .replace(/\[ARABIC\]\s*([\s\S]*?)\s*\[\/ARABIC\]/gi, '<span class="arabic-in-urdu">$1</span>')
    .replace(/\[\/?ARABIC\]/gi, '');
}

/**
 * Get the CSS class for AI-generated content based on language.
 */
export function getLangClass(language: string): string {
  if (language === 'ur') return 'lang-ur';
  if (language === 'ar') return 'lang-ar';
  return 'lang-en';
}
