import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Eye, Trash2, Loader2 } from 'lucide-react';

interface Person { id: string; full_name: string | null }
interface Scope {
  id: string;
  observer_id: string;
  student_id: string | null;
  all_students: boolean;
}

/**
 * Who may quietly sit in on a student's in-app class call.
 * Admins can always observe; this screen grants examiners/other staff either a
 * named list of students or blanket access.
 */
export function ObserverAccessPanel() {
  const { user } = useAuth();
  const [observers, setObservers] = useState<Person[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [observerId, setObserverId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [allStudents, setAllStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: roleRows }, { data: studentRows }, { data: scopeRows }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('role', ['examiner', 'teacher'] as any),
      supabase.from('user_roles').select('user_id').eq('role', 'student' as any),
      supabase.from('vcr_observer_scopes' as any).select('id, observer_id, student_id, all_students'),
    ]);

    const observerIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
    const studentIds = Array.from(new Set((studentRows ?? []).map((r: any) => r.user_id)));
    const allIds = Array.from(new Set([...observerIds, ...studentIds]));
    const { data: profiles } = allIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', allIds)
      : { data: [] as Person[] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p as Person]));

    const named = (ids: string[]) =>
      ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .sort((a, b) => (a!.full_name ?? '').localeCompare(b!.full_name ?? '')) as Person[];

    setObservers(named(observerIds));
    setStudents(named(studentIds));
    setScopes((scopeRows ?? []) as unknown as Scope[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    [...observers, ...students].forEach((p) => m.set(p.id, p.full_name ?? 'Unnamed'));
    return (id: string | null) => (id ? m.get(id) ?? 'Unknown' : '—');
  }, [observers, students]);

  const add = async () => {
    if (!observerId || (!allStudents && !studentId)) {
      toast({ title: 'Pick a person and a student', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('vcr_observer_scopes' as any).insert({
      observer_id: observerId,
      student_id: allStudents ? null : studentId,
      all_students: allStudents,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    setStudentId('');
    setAllStudents(false);
    toast({ title: 'Access granted' });
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('vcr_observer_scopes' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
      return;
    }
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4" /> Class call observers
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Grant an examiner the right to sit in on a student's in-app class call. They join muted and
          can unmute to speak. Administrators can always sit in.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Observer</Label>
            <Select value={observerId} onValueChange={setObserverId}>
              <SelectTrigger><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent>
                {observers.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.full_name ?? 'Unnamed'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId} disabled={allStudents}>
              <SelectTrigger><SelectValue placeholder={allStudents ? 'All students' : 'Choose a student'} /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name ?? 'Unnamed'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void add()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Grant access'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="all-students" checked={allStudents} onCheckedChange={setAllStudents} />
          <Label htmlFor="all-students" className="text-sm font-normal">Give access to every student</Label>
        </div>

        <div className="rounded-lg border border-border">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : scopes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No one has been given observer access yet. Administrators can still sit in on any class call.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {scopes.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{nameOf(s.observer_id)}</span>
                    <span className="text-muted-foreground">may sit in on</span>
                    {s.all_students
                      ? <Badge variant="secondary">All students</Badge>
                      : <Badge variant="outline">{nameOf(s.student_id)}</Badge>}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => void remove(s.id)} aria-label="Remove access">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
