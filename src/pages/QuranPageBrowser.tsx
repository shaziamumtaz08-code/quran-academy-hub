import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { QuranPageView } from '@/components/quran/QuranPageView';
import { formatLessonSegment, type LessonMarkerType, type LessonSegment } from '@/lib/lessonFormat';
import { toast } from '@/hooks/use-toast';

const STAFF_ROLES = ['teacher', 'admin', 'super_admin', 'admin_academic', 'admin_division', 'examiner'];

export default function QuranPageBrowser() {
  const { activeRole, profile } = useAuth();
  const [markerType, setMarkerType] = useState<LessonMarkerType>('ayah');
  const [picked, setPicked] = useState<LessonSegment | null>(null);

  const roles: string[] = (profile as any)?.roles || (activeRole ? [activeRole] : []);
  const allowed = roles.some((r) => STAFF_ROLES.includes(r));
  if (roles.length && !allowed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Quran Page View</h1>
        <p className="text-sm text-muted-foreground">
          Qudratullah 15-line IndoPak Mushaf — browse pages and mark today's lesson stop-point by tapping a line.
          Teacher-only; students and parents do not see this screen.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Marking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Record selection as</Label>
            <ToggleGroup
              type="single"
              value={markerType}
              onValueChange={(v) => v && setMarkerType(v as LessonMarkerType)}
              className="justify-start gap-2"
            >
              <ToggleGroupItem value="ayah" className="rounded-lg px-4">Ayah</ToggleGroupItem>
              <ToggleGroupItem value="ruku" className="rounded-lg px-4">Ruku</ToggleGroupItem>
              <ToggleGroupItem value="juz" className="rounded-lg px-4">Juz</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <QuranPageView
            markerType={markerType}
            onUseLesson={(seg) => {
              setPicked(seg);
              toast({ title: 'Lesson selected', description: formatLessonSegment(seg) });
            }}
          />

          {picked && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                Ready to copy into attendance
              </p>
              <p className="text-sm font-semibold">{formatLessonSegment(picked)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
