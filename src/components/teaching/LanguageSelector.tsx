import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const LABELS: Record<string, { flag: string; label: string; fontClass?: string }> = {
  en: { flag: '🇬🇧', label: 'English' },
  ur: { flag: '🇵🇰', label: 'اردو', fontClass: 'font-urdu-label' },
  ar: { flag: '🇸🇦', label: 'عربي', fontClass: 'font-arabic-label' },
};

const TOAST_MSG: Record<string, string> = {
  en: 'Language changed to English — next generation will use this language',
  ur: 'Language changed to Urdu — next generation will use this language',
  ar: 'Language changed to Arabic — next generation will use this language',
};

interface Props {
  showLabel?: boolean;
}

export function LanguageSelector({ showLabel }: Props) {
  const { language, setLanguage } = useLanguage();

  const handleChange = (lang: 'en' | 'ur' | 'ar') => {
    if (lang === language) return;
    setLanguage(lang);
    toast.success(TOAST_MSG[lang]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {showLabel && (
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Content generation language
        </span>
      )}
      <div className="inline-flex rounded-lg overflow-hidden border border-[#d0d4dc]">
        {(['en', 'ur', 'ar'] as const).map((lang) => {
          const { flag, label, fontClass } = LABELS[lang];
          const active = language === lang;
          return (
            <button
              key={lang}
              onClick={() => handleChange(lang)}
              className={`px-3 py-1.5 text-[12.5px] transition-colors flex items-center gap-1.5 ${
                active
                  ? 'bg-[#0f2044] text-white font-medium'
                  : 'bg-[#f9f9fb] text-[#7a7f8a] hover:bg-[#eef0f4]'
              } ${fontClass || ''}`}
            >
              <span>{flag}</span>
              <span className={fontClass}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
