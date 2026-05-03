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

          return (
            <Card
              key={idx}
              className={`min-h-[90px] p-1.5 ${
                !inMonth ? 'opacity-30' : ''
              } ${today ? 'ring-2 ring-primary' : ''}`}
            >
              <div className={`text-xs font-medium mb-1 ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                {format(date, 'd')}
              </div>
              <div className="space-y-0.5 overflow-hidden max-h-[60px]">
                {events.slice(0, 3).map((event, i) => (
                  <div
                    key={`${event.id}-${i}`}
                    className="text-[10px] leading-tight bg-primary/10 text-foreground rounded px-1 py-0.5 truncate"
                    title={`${event.assignment.student_name} → ${event.assignment.teacher_name} at ${formatTime12h(event.student_local_time)}`}
                  >
                    <span className="font-medium">{event.assignment.student_name.split(' ')[0]}</span>
                    <span className="text-muted-foreground ml-1">{formatTime12h(event.student_local_time)}</span>
                  </div>
                ))}
                {events.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{events.length - 3} more
                  </div>
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
