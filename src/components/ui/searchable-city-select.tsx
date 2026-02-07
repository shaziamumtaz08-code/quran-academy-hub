import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { City, ICity } from 'country-state-city';

interface SearchableCitySelectProps {
  countryCode: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const MAX_DISPLAY = 50;

export function SearchableCitySelect({
  countryCode,
  value,
  onValueChange,
  placeholder = 'Search city...',
  className,
  disabled = false,
}: SearchableCitySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const allCities = useMemo(() => {
    if (!countryCode) return [];
    return City.getCitiesOfCountry(countryCode) || [];
  }, [countryCode]);

  const filteredCities = useMemo(() => {
    if (!search.trim()) {
      return allCities.slice(0, MAX_DISPLAY);
    }
    const q = search.toLowerCase();
    const matches: ICity[] = [];
    for (const city of allCities) {
      if (city.name.toLowerCase().includes(q)) {
        matches.push(city);
        if (matches.length >= MAX_DISPLAY) break;
      }
    }
    return matches;
  }, [allCities, search]);

  const totalCount = allCities.length;
  const hasMore = search.trim()
    ? filteredCities.length >= MAX_DISPLAY
    : totalCount > MAX_DISPLAY;

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between h-9 font-normal', className)}
          disabled={disabled || !countryCode}
        >
          <span className="truncate">
            {value || (countryCode ? placeholder : 'Select country first')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            placeholder="Type to search cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="max-h-[200px]">
          <div className="p-1">
            {filteredCities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {search ? 'No cities found' : 'No cities available'}
              </p>
            ) : (
              <>
                {filteredCities.map((city) => (
                  <button
                    key={`${city.name}-${city.stateCode}`}
                    className={cn(
                      'flex items-center w-full rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                      value === city.name && 'bg-accent'
                    )}
                    onClick={() => {
                      onValueChange(city.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 flex-shrink-0',
                        value === city.name ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{city.name}</span>
                    {city.stateCode && (
                      <span className="ml-1 text-xs text-muted-foreground flex-shrink-0">
                        ({city.stateCode})
                      </span>
                    )}
                  </button>
                ))}
                {hasMore && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Type to narrow down {totalCount.toLocaleString()} cities...
                  </p>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
