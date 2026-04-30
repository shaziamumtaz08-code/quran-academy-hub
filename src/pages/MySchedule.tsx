import React, { useState } from 'react';
import TeacherSchedulesView from '@/components/teacher/TeacherSchedulesView';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

type RangeFilter = 'today' | 'this_week' | 'next_week';

export default function MySchedule() {
  const [range, setRange] = useState<RangeFilter>('this_week');

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-lms-navy flex items-center gap-2">
          <Calendar className="h-6 w-6" /> My Schedule
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your weekly classes (read-only — contact admin for changes)
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={range === 'today' ? 'default' : 'outline'}
          onClick={() => setRange('today')}
        >
          Today
        </Button>
        <Button
          size="sm"
          variant={range === 'this_week' ? 'default' : 'outline'}
          onClick={() => setRange('this_week')}
        >
          This Week
        </Button>
        <Button
          size="sm"
          variant={range === 'next_week' ? 'default' : 'outline'}
          onClick={() => setRange('next_week')}
        >
          Next Week
        </Button>
      </div>

      <TeacherSchedulesView readOnly rangeFilter={range} />
    </div>
  );
}
