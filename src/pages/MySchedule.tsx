import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import UpcomingScheduleView, { ScheduleRange } from '@/components/schedule/UpcomingScheduleView';

export default function MySchedule() {
  const [range, setRange] = useState<ScheduleRange>('this_week');
  const { activeRole, profile } = useAuth();
  const role = activeRole || profile?.role;
  const mode: 'teacher' | 'student' = role === 'student' ? 'student' : 'teacher';

  return (
    <PageShell
      title="My Schedule"
      description="Your upcoming classes (read-only — contact admin for changes)."
    >
      <div className="space-y-4 max-w-4xl">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div className="flex gap-2">
            {(['today', 'this_week', 'next_week'] as ScheduleRange[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? 'default' : 'outline'}
                onClick={() => setRange(r)}
              >
                {r === 'today' ? 'Today' : r === 'this_week' ? 'This Week' : 'Next Week'}
              </Button>
            ))}
          </div>
        </div>

        <UpcomingScheduleView mode={mode} range={range} />
      </div>
    </PageShell>
  );
}
