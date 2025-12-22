import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SURAHS, type SurahInfo } from '@/lib/quranData';

interface SurahSearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SurahSearchSelect({
  value,
  onChange,
  placeholder = 'Select a Surah...',
  disabled = false,
}: SurahSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedSurah = useMemo(() => {
    if (!value) return null;
    return SURAHS.find(s => s.name === value || s.name.toLowerCase() === value.toLowerCase());
  }, [value]);

  const filteredSurahs = useMemo(() => {
    if (!searchQuery) return SURAHS;
    const query = searchQuery.toLowerCase();
    return SURAHS.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.englishName.toLowerCase().includes(query) ||
      s.number.toString().includes(query)
    );
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedSurah ? (
            <span className="flex items-center gap-2 truncate">
              <span className="text-muted-foreground text-xs">{selectedSurah.number}.</span>
              <span>{selectedSurah.name}</span>
              <span className="text-muted-foreground text-xs">({selectedSurah.englishName})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search surah by name or number..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No surah found.</CommandEmpty>
            <CommandGroup>
              {filteredSurahs.map((surah) => (
                <CommandItem
                  key={surah.number}
                  value={surah.name}
                  onSelect={() => {
                    onChange(surah.name);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-6">{surah.number}.</span>
                    <span className="font-medium">{surah.name}</span>
                    <span className="text-muted-foreground text-xs">({surah.englishName})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{surah.totalAyahs} ayahs</span>
                    <Check
                      className={cn(
                        'h-4 w-4',
                        value === surah.name ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
