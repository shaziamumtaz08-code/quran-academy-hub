import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function PinInput({ length = 4, value, onChange, disabled, error }: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focused, setFocused] = useState(-1);

  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  useEffect(() => {
    if (!disabled && value.length === 0) {
      inputRefs.current[0]?.focus();
    }
  }, [disabled]);

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const newDigits = [...digits];
    newDigits[index] = char;
    const newValue = newDigits.join('').replace(/[^\d]/g, '');
    onChange(newValue);

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      onChange(newDigits.join('').replace(/[^\d]/g, ''));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted);
    const nextIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputRefs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={() => setFocused(i)}
          onBlur={() => setFocused(-1)}
          onPaste={handlePaste}
          className={cn(
            "w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 bg-background transition-all duration-200 outline-none",
            "focus:ring-2 focus:ring-primary/30 focus:border-primary",
            focused === i && "border-primary scale-105 shadow-md",
            error && "border-destructive shake-animation",
            disabled && "opacity-50 cursor-not-allowed",
            !error && focused !== i && "border-border hover:border-muted-foreground/50"
          )}
          aria-label={`PIN digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
