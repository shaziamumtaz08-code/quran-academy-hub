import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { formatTime12h } from '@/lib/timezones';

interface Assignment {
  id: string;
  student_name: string;
  teacher_name: string;
  subject_name: string | null;
  student_country: string | null;
  teacher_country: string | null;
}

interface Schedule {
  id: string;
  assignment_id: string;
  day_of_week: string;
  student_local_time: string;
  teacher_local_time: string;
  duration_minutes: number;
  is_active: boolean;
}

interface MonthlyCalendarViewProps {
  assignments: Assignment[];
  schedules: Schedule[];
  onSelectDate?: (date: Date) => void;
}

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function MonthlyCalendarView({ assignments, schedules, onSelectDate }: MonthlyCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart); // Sunday start
    const calEnd = endOfWeek(monthEnd);

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Map schedules to day-of-week number for quick lookup
  const schedulesByDayOfWeek = useMemo(() => {
    const map = new Map<number, Array<Schedule & { assignment: Assignment }>>();
    for (const s of schedules) {
      if (!s.is_active) continue;
      const dayNum = DAY_MAP[s.day_of_week.toLowerCase()];
      if (dayNum === undefined) continue;
      const assignment = assignments.find(a => a.id === s.assignment_id);
      if (!assignment) continue;
      if (!map.has(dayNum)) map.set(dayNum, []);
      map.get(dayNum)!.push({ ...s, assignment });
    }
    return map;
  }, [schedules, assignments]);

  const getEventsForDate = (date: Date) => {
    const dayOfWeek = date.getDay(); // 0=Sunday
    return schedulesByDayOfWeek.get(dayOfWeek) || [];
  };

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, idx) => {
          const inMonth = isSameMonth(date, currentMonth);
          const today = isToday(date);
          const events = getEventsForDate(date);
          const count = events.length;

          return (
            <Card
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => inMonth && onSelectDate?.(date)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && inMonth) onSelectDate?.(date); }}
              className={`min-h-[90px] p-2 flex flex-col cursor-pointer transition hover:border-primary hover:shadow-sm ${
                !inMonth ? 'opacity-30 pointer-events-none' : ''
              } ${today ? 'ring-2 ring-primary' : ''}`}
              title={inMonth ? `${count} class${count === 1 ? '' : 'es'} on ${format(date, 'EEE, MMM d')} — click to open daily view` : ''}
            >
              <div className="flex items-center justify-between">
                <div className={`text-xs font-medium ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(date, 'd')}
                </div>
                {count > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>
                )}
              </div>
              <div className="flex-1 flex items-center justify-center">
                {count > 0 ? (
                  <div className="text-center">
                    <div className="text-2xl font-bold leading-none text-foreground">{count}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">class{count === 1 ? '' : 'es'}</div>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground">—</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/10 border border-primary/30" />
          <span>Scheduled class</span>
        </div>
        <span>Total: {schedules.filter(s => s.is_active).length} classes/week × 4 weeks shown</span>
      </div>
    </div>
  );
}
