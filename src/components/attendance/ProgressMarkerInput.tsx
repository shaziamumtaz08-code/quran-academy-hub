import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type PrimaryMarker = 'rukus' | 'pages' | 'lines';

interface ProgressMarkerInputProps {
  marker: PrimaryMarker;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const RUKU_OPTIONS = [
  { value: 'full', label: 'Full Ruku', numericValue: 1 },
  { value: 'more_than_half', label: '> Half Ruku', numericValue: 0.75 },
  { value: 'half', label: 'Half Ruku', numericValue: 0.5 },
  { value: 'less_than_half', label: '< Half Ruku', numericValue: 0.25 },
];

const PAGE_OPTIONS = [
  { value: 'full', label: 'Full Page', numericValue: 1 },
  { value: 'more_than_half', label: '> Half Page', numericValue: 0.75 },
  { value: 'half', label: 'Half Page', numericValue: 0.5 },
  { value: 'less_than_half', label: '< Half Page', numericValue: 0.25 },
];

// Export for use in attendance calculation
export const getProgressNumericValue = (marker: PrimaryMarker, progressValue: string): number => {
  if (marker === 'rukus') {
    return RUKU_OPTIONS.find(o => o.value === progressValue)?.numericValue || 0;
  }
  if (marker === 'pages') {
    return PAGE_OPTIONS.find(o => o.value === progressValue)?.numericValue || 0;
  }
  return 0;
};

export function ProgressMarkerInput({ marker, value, onChange, disabled }: ProgressMarkerInputProps) {
  // For lines, don't show this component - use regular number input
  if (marker === 'lines') {
    return null;
  }

  const options = marker === 'rukus' ? RUKU_OPTIONS : PAGE_OPTIONS;
  const markerLabel = marker === 'rukus' ? 'Ruku' : 'Page';

  return (
    <div className="space-y-2">
      <Label>Progress Today <span className="text-destructive">*</span></Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${markerLabel} progress`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Select the amount of {markerLabel.toLowerCase()} covered today
      </p>
    </div>
  );
}
