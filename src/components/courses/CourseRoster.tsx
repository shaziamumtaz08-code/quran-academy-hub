import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Search, Users, UserPlus, X, Shuffle, CheckCircle2, Loader2, ChevronDown,
  GraduationCap, Shield, Eye
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  courseId: string;
}

const STAFF_ROLE_COLORS: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-700',
  moderator: 'bg-teal-100 text-teal-700',
  supervisor: 'bg-amber-100 text-amber-700',
  assistant: 'bg-violet-100 text-violet-700',
  examiner: 'bg-amber-100 text-amber-700',
  observer: 'bg-slate-100 text-slate-700',
};

export function CourseRoster({ courseId }: Props) {
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [addStaffDialog, setAddStaffDialog] = useState<{ classId: string; className: string } | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRole, setStaffRole] = useState('teacher');

  // ─── Unassigned students ───
  const { data: unassigned = [], isLoading: loadingUnassigned } = useQuery({
    queryKey: ['roster-unassigned', courseId],
    queryFn: async () => {
      const { data: enrolled } = await supabase.from('course_enrollments')
        .select('student_id')
        .eq('course_id', courseId)
        .eq('status', 'active');

      if (!enrolled?.length) return [];

      const enrolledIds = enrolled.map(e => e.student_id);

      const { data: assigned } = await supabase.from('course_class_students')
        .select('student_id, class:course_classes!inner(course_id)')
        .eq('class.course_id', courseId);

      const assignedIds = new Set((assigned || []).map(a => a.student_id));
      const unassignedIds = enrolledIds.filter(id => !assignedIds.has(id));

      if (!unassignedIds.length) return [];

      const { data: profiles } = await supabase.from('profiles')
        .select('id, full_name, email')
        .in('id', unassignedIds);

      return profiles || [];
    },
  });

  // ─── Classes with students and staff ───
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['roster-classes', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_classes')
        .select(`
          id, name, schedule_days, schedule_time, max_seats,
          students:course_class_students(id, student_id, status, profile:student_id(id, full_name, email)),
          staff:course_class_staff(id, user_id, staff_role, profile:user_id(id, full_name, email))
        `)
        .eq('course_id', courseId)
        .order('created_at');
      return data || [];
    },
  });

  // ─── Available staff ───
  const { data: availableStaff = [] } = useQuery({
    queryKey: ['available-staff'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles')
        .select('user_id, role')
        .in('role', ['teacher', 'admin', 'super_admin', 'examiner']);

      if (!data?.length) return [];

      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase.from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const roleMap = new Map<string, string[]>();
      data.forEach(r => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      });

      return (profiles || []).map(p => ({ ...p, roles: roleMap.get(p.id) || [] }));
    },
  });

  // ─── Filtered unassigned ───
  const filteredUnassigned = useMemo(() => {
    if (!searchTerm) return unassigned;
    const s = searchTerm.toLowerCase();
    return unassigned.filter(u =>
      (u.full_name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s)
    );
  }, [unassigned, searchTerm]);

  // ─── Selection helpers ───
  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStudents.size === filteredUnassigned.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredUnassigned.map(u => u.id)));
    }
  };

  // ─── Assign students ───
  const handleAssignStudents = async (classId: string) => {
    const studentIds = Array.from(selectedStudents);
    const targetClass = classes.find(c => c.id === classId);
    const currentCount = targetClass?.students?.length || 0;
    const maxCapacity = targetClass?.max_seats || 999;

    if (currentCount + studentIds.length > maxCapacity) {
      toast.error(`"${targetClass?.name}" only has ${maxCapacity - currentCount} seats remaining`);
      return;
    }

    const records = studentIds.map(sid => ({
      class_id: classId,
      student_id: sid,
      status: 'active',
    }));

    const { error } = await supabase.from('course_class_students').insert(records);
    if (error) { toast.error(error.message); return; }

    toast.success(`${studentIds.length} student${studentIds.length > 1 ? 's' : ''} assigned to ${targetClass?.name}`);
    setSelectedStudents(new Set());
    queryClient.invalidateQueries({ queryKey: ['roster-unassigned', courseId] });
    queryClient.invalidateQueries({ queryKey: ['roster-classes', courseId] });
  };

  // ─── Remove student ───
  const handleRemoveStudent = async (classStudentId: string, studentName: string) => {
    const { error } = await supabase.from('course_class_students').delete().eq('id', classStudentId);
    if (error) { toast.error(error.message); return; }

    toast.success(`${studentName} removed from class`);
    queryClient.invalidateQueries({ queryKey: ['roster-unassigned', courseId] });
    queryClient.invalidateQueries({ queryKey: ['roster-classes', courseId] });
  };

  // ─── Remove staff ───
  const handleRemoveStaff = async (staffId: string) => {
    const { error } = await supabase.from('course_class_staff').delete().eq('id', staffId);
    if (error) { toast.error(error.message); return; }

    toast.success('Staff removed');
    queryClient.invalidateQueries({ queryKey: ['roster-classes', courseId] });
  };

  // ─── Add staff ───
  const handleAddStaff = async (classId: string, userId: string, role: string) => {
    const existing = classes.find(c => c.id === classId)?.staff?.find((s: any) => s.user_id === userId);
    if (existing) { toast.error('Already assigned to this class'); return; }

    const { error } = await supabase.from('course_class_staff').insert({
      class_id: classId,
      user_id: userId,
      staff_role: role,
    });
    if (error) { toast.error(error.message); return; }

    toast.success('Staff assigned');
    setAddStaffDialog(null);
    setStaffSearch('');
    queryClient.invalidateQueries({ queryKey: ['roster-classes', courseId] });
  };

  // ─── Auto-assign ───
  const handleAutoAssign = async () => {
    if (!unassigned.length || !classes.length) return;
    setBatchLoading(true);

    const assignments: { class_id: string; student_id: string; status: string }[] = [];
    const classCounts = classes.map(c => ({
      id: c.id,
      name: c.name,
      count: c.students?.length || 0,
      max: c.max_seats || 999,
    }));

    for (const student of unassigned) {
      classCounts.sort((a, b) => a.count - b.count);
      const target = classCounts.find(c => c.count < c.max);
      if (!target) break;
      assignments.push({ class_id: target.id, student_id: student.id, status: 'active' });
      target.count++;
    }

    if (assignments.length) {
      const { error } = await supabase.from('course_class_students').insert(assignments);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`${assignments.length} students auto-assigned across ${classes.length} classes`);
        setSelectedStudents(new Set());
        queryClient.invalidateQueries({ queryKey: ['roster-unassigned', courseId] });
        queryClient.invalidateQueries({ queryKey: ['roster-classes', courseId] });
      }
    }
    setBatchLoading(false);
  };

  // ─── Empty states ───
  if (loadingClasses || loadingUnassigned) {
    return (
      <div className="flex flex-col lg:flex-row gap-4">
        <Skeleton className="h-96 flex-[2]" />
        <Skeleton className="h-96 flex-[3]" />
      </div>
    );
  }

  if (!classes.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium">No class sections created</p>
          <p className="mt-1">Create class sections first in the Classes tab before assigning students.</p>
        </CardContent>
      </Card>
    );
  }

  const filteredStaff = availableStaff.filter(s =>
    !staffSearch || (s.full_name || '').toLowerCase().includes(staffSearch.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(staffSearch.toLowerCase())
  );

  const singleClass = classes.length === 1;

  return (
    <>
      {singleClass ? (
        /* ─── SINGLE CLASS: flat student list ─── */
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {classes[0].name}
                  <Badge variant="secondary" className="text-xs">
                    {(classes[0].students?.length || 0)}/{classes[0].max_seats || '∞'}
                  </Badge>
                </CardTitle>
                {unassigned.length > 0 && (
                  <Button size="sm" variant="outline" onClick={handleAutoAssign} disabled={batchLoading} className="gap-1.5">
                    {batchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
                    Auto-assign {unassigned.length}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {(classes[0].students || []).length > 0 ? (
                <div className="space-y-1">
                  {(classes[0].students || []).map((s: any) => (
                    <div key={s.id} className="flex items-center gap-2 group px-2 py-1.5 rounded-md hover:bg-muted/50">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                        {(s.profile?.full_name || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-sm flex-1 truncate">{s.profile?.full_name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-32">{s.profile?.email}</span>
                      <Button
                        size="icon" variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveStudent(s.id, s.profile?.full_name || 'Student')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic px-2 py-3">No students assigned yet</p>
              )}

              <Separator />

              {/* Staff section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Staff</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                    onClick={() => setAddStaffDialog({ classId: classes[0].id, className: classes[0].name })}>
                    <UserPlus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {(classes[0].staff || []).length > 0 ? (
                  <div className="space-y-1">
                    {(classes[0].staff || []).map((st: any) => {
                      const roleClass = STAFF_ROLE_COLORS[st.staff_role] || STAFF_ROLE_COLORS.observer;
                      return (
                        <div key={st.id} className="flex items-center gap-2 group px-2 py-1.5 rounded-md hover:bg-muted/50">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                            {(st.profile?.full_name || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-sm flex-1 truncate">{st.profile?.full_name}</span>
                          <Badge className={cn('text-[10px] border-0', roleClass)}>{st.staff_role}</Badge>
                          <Button size="icon" variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveStaff(st.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic px-2">No staff assigned</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
      <div className="flex flex-col lg:flex-row gap-4">
        {/* ─── LEFT: Unassigned Students ─── */}
        <Card className="flex-[2] min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Unassigned
                <Badge variant="secondary" className="text-xs">{unassigned.length}</Badge>
              </CardTitle>
              {unassigned.length > 0 && classes.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAutoAssign}
                  disabled={batchLoading}
                  className="gap-1.5"
                >
                  {batchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
                  Auto-assign
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {unassigned.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p>All enrolled students have been assigned to classes</p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    className="pl-9 h-9"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 px-1">
                  <Checkbox
                    checked={selectedStudents.size === filteredUnassigned.length && filteredUnassigned.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedStudents.size > 0 ? `${selectedStudents.size} selected` : 'Select all'}
                  </span>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {filteredUnassigned.map(student => (
                    <div
                      key={student.id}
                      className={cn(
                        'flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors',
                        selectedStudents.has(student.id) && 'bg-primary/5'
                      )}
                    >
                      <Checkbox
                        checked={selectedStudents.has(student.id)}
                        onCheckedChange={() => toggleStudent(student.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{student.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{student.email || ''}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Assign button */}
                {selectedStudents.size > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="w-full gap-1.5" size="sm">
                        Assign {selectedStudents.size} → class
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      {classes.map(cls => {
                        const count = cls.students?.length || 0;
                        const max = cls.max_seats || 999;
                        const full = count >= max;
                        return (
                          <DropdownMenuItem
                            key={cls.id}
                            disabled={full}
                            onClick={() => handleAssignStudents(cls.id)}
                          >
                            <span className="flex-1">{cls.name}</span>
                            <span className={cn('text-xs', full ? 'text-destructive' : 'text-muted-foreground')}>
                              {count}/{max}
                            </span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── RIGHT: Class Sections ─── */}
        <div className="flex-[3] space-y-4">
          {classes.map(cls => {
            const students = cls.students || [];
            const staff = cls.staff || [];
            const count = students.length;
            const max = cls.max_seats || 999;
            const pct = Math.min(100, Math.round((count / max) * 100));
            const capacityColor = pct > 90 ? 'text-destructive' : pct > 70 ? 'text-amber-600' : 'text-emerald-600';

            return (
              <Card key={cls.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{cls.name}</CardTitle>
                      {cls.schedule_days?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cls.schedule_days.join(', ')}{cls.schedule_time ? ` · ${cls.schedule_time}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={cn('text-sm font-medium', capacityColor)}>
                        {count}/{max}
                      </span>
                      <Progress value={pct} className="h-1.5 w-20 mt-1" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Students */}
                  {students.length > 0 ? (
                    <div className="space-y-1">
                      {students.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2 group px-2 py-1.5 rounded-md hover:bg-muted/50">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                            {(s.profile?.full_name || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-sm flex-1 truncate">{s.profile?.full_name || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-32">{s.profile?.email}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveStudent(s.id, s.profile?.full_name || 'Student')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic px-2 py-3">No students assigned</p>
                  )}

                  <Separator />

                  {/* Staff */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Staff</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => setAddStaffDialog({ classId: cls.id, className: cls.name })}
                      >
                        <UserPlus className="h-3 w-3" /> Add
                      </Button>
                    </div>
                    {staff.length > 0 ? (
                      <div className="space-y-1">
                        {staff.map((st: any) => {
                          const roleClass = STAFF_ROLE_COLORS[st.staff_role] || STAFF_ROLE_COLORS.observer;
                          return (
                            <div key={st.id} className="flex items-center gap-2 group px-2 py-1.5 rounded-md hover:bg-muted/50">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                {(st.profile?.full_name || '?')[0].toUpperCase()}
                              </div>
                              <span className="text-sm flex-1 truncate">{st.profile?.full_name}</span>
                              <Badge className={cn('text-[10px] border-0', roleClass)}>{st.staff_role}</Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveStaff(st.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic px-2">No staff assigned</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ─── Add Staff Dialog ─── */}
      <Dialog open={!!addStaffDialog} onOpenChange={() => { setAddStaffDialog(null); setStaffSearch(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add staff to {addStaffDialog?.className}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={staffRole} onValueChange={setStaffRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
                <SelectItem value="examiner">Examiner</SelectItem>
                <SelectItem value="observer">Observer</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                className="pl-9"
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredStaff.map(person => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => addStaffDialog && handleAddStaff(addStaffDialog.classId, person.id, staffRole)}
                >
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {(person.full_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{person.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{person.email}</p>
                  </div>
                  <div className="flex gap-1">
                    {person.roles.map(r => (
                      <Badge key={r} variant="secondary" className="text-[9px] px-1">{r}</Badge>
                    ))}
                  </div>
                </div>
              ))}
              {filteredStaff.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No staff found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
