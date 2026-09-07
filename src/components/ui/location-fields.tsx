import React, { useMemo } from 'react';
import { Country } from 'country-state-city';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableCitySelect } from '@/components/ui/searchable-city-select';
import { normalizeTimezone, TIMEZONES_SORTED } from '@/lib/timezones';

const ALL_COUNTRIES = Country.getAllCountries();

/** Zones offered for a country (falls back to the full curated list). */
export function zonesForCountry(countryCode?: string | null): string[] {
  const country = countryCode ? ALL_COUNTRIES.find(c => c.isoCode === countryCode) : undefined;
  const zones = (country?.timezones || []).map(z => z.zoneName).filter(Boolean);
  const unique = Array.from(new Set(zones));
  return unique.length ? unique : TIMEZONES_SORTED.map(t => t.value);
}

/** Best default zone for a country (single-zone countries resolve exactly). */
export function defaultZoneForCountry(countryCode?: string | null): string {
  const zones = zonesForCountry(countryCode);
  return zones.length === 1 ? zones[0] : '';
}

interface TimezoneSelectProps {
  countryCode?: string | null;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * The single way a timezone gets picked anywhere in the app.
 * Only real IANA zones can be chosen, and the list is scoped to the country
 * so a person can never end up with a timezone from another country.
 */
export function TimezoneSelect({ countryCode, value, onValueChange, className, disabled }: TimezoneSelectProps) {
  const zones = useMemo(() => {
    const list = zonesForCountry(countryCode);
    const current = value ? normalizeTimezone(value) : '';
    return current && !list.includes(current) ? [current, ...list] : list;
  }, [countryCode, value]);

  return (
    <Select value={value ? normalizeTimezone(value) : ''} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={countryCode ? 'Select timezone' : 'Select a country first'} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {zones.map(zone => (
          <SelectItem key={zone} value={zone}>{zone.replace(/_/g, ' ')}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface LocationValue {
  countryCode: string;
  country: string;
  city: string;
  timezone: string;
}

interface LocationFieldsProps {
  value: LocationValue;
  onChange: (patch: Partial<LocationValue>) => void;
  labels?: boolean;
}

/** Country → City → Timezone, always kept consistent with each other. */
export function LocationFields({ value, onChange, labels = true }: LocationFieldsProps) {
  const chooseCountry = (code: string) => {
    const country = ALL_COUNTRIES.find(c => c.isoCode === code);
    if (!country) return;
    onChange({
      countryCode: code,
      country: country.name,
      city: '',
      timezone: defaultZoneForCountry(code) || zonesForCountry(code)[0] || '',
    });
  };

  return (
    <>
      <div>
        {labels && <Label>Country</Label>}
        <Select value={value.countryCode} onValueChange={chooseCountry}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select country" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {ALL_COUNTRIES.map(c => <SelectItem key={c.isoCode} value={c.isoCode}>{c.flag} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        {labels && <Label>City</Label>}
        <SearchableCitySelect className="mt-1" countryCode={value.countryCode} value={value.city} onValueChange={city => onChange({ city })} />
      </div>
      <div>
        {labels && <Label>Timezone</Label>}
        <TimezoneSelect className="mt-1" countryCode={value.countryCode} value={value.timezone} onValueChange={timezone => onChange({ timezone })} />
      </div>
    </>
  );
}

export { ALL_COUNTRIES };
