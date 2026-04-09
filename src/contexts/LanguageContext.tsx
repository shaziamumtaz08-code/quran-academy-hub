import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type Language = 'en' | 'ur' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  langClass: string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  langClass: 'lang-en',
});

export const useLanguage = () => useContext(LanguageContext);

const LANG_CLASS_MAP: Record<Language, string> = {
  en: 'lang-en',
  ur: 'lang-ur',
  ar: 'lang-ar',
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('tos-language');
    return (stored === 'ur' || stored === 'ar') ? stored : 'en';
  });

  // Load from DB on mount
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('profiles')
      .select('teaching_os_language')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        if (data?.teaching_os_language && ['en', 'ur', 'ar'].includes(data.teaching_os_language)) {
          setLanguageState(data.teaching_os_language as Language);
          localStorage.setItem('tos-language', data.teaching_os_language);
        }
      });
  }, [profile?.id]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('tos-language', lang);
    // Async persist to DB
    if (profile?.id) {
      supabase
        .from('profiles')
        .update({ teaching_os_language: lang })
        .eq('id', profile.id)
        .then(() => {});
    }
  }, [profile?.id]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, langClass: LANG_CLASS_MAP[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}
