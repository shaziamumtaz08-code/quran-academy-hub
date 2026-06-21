import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogIn, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useKidContext } from '@/contexts/KidContext';
import { supabase } from '@/integrations/supabase/client';
import { ConditionalDashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ChildRow {
  id: string;
  full_name: string;
  email: string | null;
  enrolled: boolean;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { setActiveKidId } = useKidContext();

  // Two-step fetch so RLS quirks on the FK-aliased join don't drop rows.
  const { data: children = [], isLoading } = useQuery({
    queryKey: ['parent-children-hub', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ChildRow[]> => {
      const { data: links } = await supabase
        .from('student_parent_links')
        .select('student_id')
        .eq('parent_id', user!.id);
      const ids = (links || []).map((l: any) => l.student_id).filter(Boolean);
      if (!ids.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);

      const { data: enrolls } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .in('student_id', ids)
        .eq('status', 'active');
      const enrolledSet = new Set((enrolls || []).map((e: any) => e.student_id));

      const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
      return ids.map((id) => {
        const p: any = byId.get(id) || { id, full_name: 'Child', email: null };
        return {
          id,
          full_name: p.full_name || 'Child',
          email: p.email,
          enrolled: enrolledSet.has(id),
        };
      });
    },
  });

  // When entering /parent/child/:studentId, set the active kid so StudentDashboard hydrates.
  useEffect(() => {
    if (studentId) setActiveKidId(studentId);
  }, [studentId, setActiveKidId]);

  if (!user?.id) return null;

  // Child view — render the selected kid's StudentDashboard.
  if (studentId) {
    return (
      <ConditionalDashboardLayout>
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/parent')}>
            ← Back to My Children
          </Button>
          <StudentDashboard />
        </div>
      </ConditionalDashboardLayout>
    );
  }

  // Hub view — child selector.
  return (
    <ConditionalDashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">My Children</h1>
              <p className="text-sm text-muted-foreground">
                Select a child to open their dashboard, attendance, fees and reports.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
          </div>
        ) : children.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No linked children on your account yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((c) => {
              const initial = (c.full_name || 'C').trim()[0].toUpperCase();
              return (
                <div
                  key={c.id}
                  className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-lg font-bold">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{c.full_name}</p>
                      {c.email && (
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2"
                    disabled={!c.enrolled}
                    onClick={() => navigate(`/parent/child/${c.id}`)}
                  >
                    <LogIn className="w-4 h-4" />
                    {c.enrolled ? "Open Child's Dashboard" : 'Not Enrolled in Current Session'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ConditionalDashboardLayout>
  );
}
