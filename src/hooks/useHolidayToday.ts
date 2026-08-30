import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAcademyTimezone, zonedParts } from '@/hooks/useAcademyTimezone';

export interface HolidayRow {
  holiday_date: string;
  name: string | null;
  division_id: string | null;
}

/**
 * Academy holiday lookup for a given date.
 *
 * Holiday dates are stored in the TEACHER/academy local frame — the same frame
 * as `attendance.class_date` and `schedules.day_of_week`. So the default date
 * is resolved in the academy timezone, never the viewer's browser date
 * (otherwise a US student would see the holiday shift by a day).
 */
export function useHolidayOn(date?: string) {
  const { activeDivision } = useDivision();
  const academyTz = useAcademyTimezone();
  const day = date || zonedParts(new Date(), academyTz).dateKey;


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
