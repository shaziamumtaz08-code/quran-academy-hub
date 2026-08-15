import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { SURAHS } from '@/lib/quranData';
import { cn } from '@/lib/utils';

interface Props {
  /** Called with the chosen surah + ayah when the teacher hits Go. */
  onJump: (surah: number, ayah: number) => void;
  busy?: boolean;
  className?: string;
}

export function MushafSearchBar({ onJump, busy, className }: Props) {
  const [open, setOpen] = useState(false);
  const [surah, setSurah] = useState<number | null>(null);
  const [ayah, setAyah] = useState('1');

  const selected = useMemo(() => SURAHS.find((s) => s.number === surah) ?? null, [surah]);
  const max = selected?.totalAyahs ?? 286;
  const ayahNum = Number(ayah);
  const valid = !!selected && Number.isFinite(ayahNum) && ayahNum >= 1 && ayahNum <= max;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (valid && selected) onJump(selected.number, ayahNum);
  };

  return (
    <form onSubmit={submit} className={cn('flex flex-wrap items-end gap-2', className)} dir="ltr">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-0 flex-1 sm:flex-none sm:w-64 justify-between rounded-full"
          >
            <span className="truncate">
              {selected ? `${selected.number}. ${selected.name}` : 'Find a surah…'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search surah name or number…" />
            <CommandList>
              <CommandEmpty>No surah found.</CommandEmpty>
              <CommandGroup>
                {SURAHS.map((s) => (
                  <CommandItem
                    key={s.number}
                    value={`${s.number} ${s.name} ${s.englishName}`}
                    onSelect={() => {
                      setSurah(s.number);
                      setAyah('1');
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', surah === s.number ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">
                      {s.number}. {s.name}
                      <span className="text-muted-foreground"> — {s.englishName}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        type="number"
        min={1}
        max={max}
        inputMode="numeric"
        value={ayah}
        onChange={(e) => setAyah(e.target.value)}
        aria-label="Verse number"
        placeholder="Verse"
        className="w-24 rounded-full"
      />

      <Button type="submit" size="sm" className="rounded-full" disabled={!valid || busy}>
        <Search className="h-4 w-4 mr-1.5" />
        Go
      </Button>

      {selected && (
        <span className="text-xs text-muted-foreground w-full sm:w-auto">
          1–{max} verses
        </span>
      )}
    </form>
  );
}

export default MushafSearchBar;
