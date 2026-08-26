import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { PageShell } from '@/components/layout/PageShell';
import UpcomingScheduleView, { ScheduleRange } from '@/components/schedule/UpcomingScheduleView';
import GroupClassScheduleView from '@/components/schedule/GroupClassScheduleView';

export default function MySchedule() {
  const [range, setRange] = useState<ScheduleRange>('this_week');
  const { activeRole, profile } = useAuth();
  const { activeDivision } = useDivision();
  const role = activeRole || profile?.role;
  const mode: 'teacher' | 'student' = role === 'student' ? 'student' : 'teacher';
  const modelType = (activeDivision?.model_type as string) || null;
  const isGroup = modelType === 'group';
  const isRecorded = modelType === 'recorded';

  return (
    <PageShell
      title="My Schedule"
      description="Your upcoming classes (read-only — contact admin for changes)."
    >
      <div className="space-y-4 max-w-4xl">
        {!isGroup && !isRecorded && (
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
        )}

        {isRecorded ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-base font-medium">No live schedule</p>
            <p className="text-sm mt-1">Recorded courses don't have a live schedule.</p>
          </div>
        ) : isGroup ? (
          <GroupClassScheduleView mode={mode} />
        ) : (
          <UpcomingScheduleView mode={mode} range={range} />
        )}
      </div>
    </PageShell>
  );
}
