import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';

export interface HolidayRow {
  holiday_date: string;
  name: string | null;
  division_id: string | null;
}

/**
 * Academy holiday lookup for a given date (defaults to today, local frame).
 * A holiday applies when it is academy-wide (division_id is null) or belongs
 * to the currently active division.
 */
export function useHolidayOn(date?: string) {
  const { activeDivision } = useDivision();
  const day = date || new Date().toLocaleDateString('en-CA');

  return useQuery({
    queryKey: ['holiday-on', day, activeDivision?.id ?? 'all'],
    queryFn: async (): Promise<HolidayRow | null> => {
      const { data, error } = await supabase
        .from('holidays' as any)
        .select('holiday_date, name, division_id')
        .eq('holiday_date', day);
      if (error) return null;
      const rows = (data || []) as unknown as HolidayRow[];
      const match =
        rows.find((r) => r.division_id && r.division_id === activeDivision?.id) ||
        rows.find((r) => !r.division_id) ||
        null;
      return match;
    },
    staleTime: 5 * 60 * 1000,
  });
}
