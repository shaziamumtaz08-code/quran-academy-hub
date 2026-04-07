import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Plus, Trash2, Users, Clock, MapPin, DollarSign, Loader2, Video, UserPlus,
  Calendar, ArrowLeft, Settings, GraduationCap, Shield, ChevronRight
} from 'lucide-react';

interface CourseClassesTabProps {
  courseId: string;
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const CLASS_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'trial', label: 'Trial' },
  { value: 'makeup', label: 'Make-up' },
];
const PAYOUT_TYPES = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'per_session', label: 'Per Session' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'per_student', label: 'Per Student' },
];

export function CourseClassesTab({ courseId }: CourseClassesTabProps) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['course-classes', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_classes')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  if (selectedClassId) {
    const cls = classes.find((c: any) => c.id === selectedClassId);
    if (!cls) return null;
    return <ClassDetail cls={cls} courseId={courseId} onBack={() => setSelectedClassId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Classes</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Class
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : classes.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-40" />
          No classes created yet. Create your first class to get started.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls: any) => (
            <Card key={cls.id} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedClassId(cls.id)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{cls.name}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{cls.class_type}</Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(cls.schedule_days || []).map((d: string) => (
                    <Badge key={d} variant="secondary" className="text-[10px]">{d.slice(0, 3)}</Badge>
                  ))}
                  {cls.schedule_time && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Clock className="h-3 w-3" />{cls.schedule_time?.slice(0, 5)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{cls.max_seats} seats</span>
                  <span>{cls.session_duration} min</span>
                  {cls.is_volunteer ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">Volunteer</Badge>
                  ) : (
                    <span>{cls.fee_currency} {cls.fee_amount}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateClassDialog open={createOpen} onOpenChange={setCreateOpen} courseId={courseId} />
    </div>
  );
}

// ═══ CREATE CLASS DIALOG ═══
function CreateClassDialog({ open, onOpenChange, courseId }: { open: boolean; onOpenChange: (v: boolean) => void; courseId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [duration, setDuration] = useState(30);
  const [meetingLink, setMeetingLink] = useState('');
  const [zoomLicenseId, setZoomLicenseId] = useState('');
  const [maxSeats, setMaxSeats] = useState(30);
  const [classType, setClassType] = useState('regular');
  const [feeAmount, setFeeAmount] = useState(0);
  const [feeCurrency, setFeeCurrency] = useState('PKR');
  const [isVolunteer, setIsVolunteer] = useState(false);

  const { data: zoomLicenses = [] } = useQuery({
    queryKey: ['zoom-licenses-picker'],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from('zoom_licenses').select('id, zoom_email, meeting_link').order('priority');
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const selectedLicense = zoomLicenses.find((z: any) => z.id === zoomLicenseId);
      const { error } = await supabase.from('course_classes').insert({
        course_id: courseId,
        name: name.trim(),
        schedule_days: days,
        schedule_time: time || null,
        timezone,
        session_duration: duration,
        meeting_link: zoomLicenseId ? (selectedLicense?.meeting_link || '') : meetingLink,
        zoom_license_id: zoomLicenseId || null,
        max_seats: maxSeats,
        class_type: classType,
        fee_amount: isVolunteer ? 0 : feeAmount,
        fee_currency: feeCurrency,
        is_volunteer: isVolunteer,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-classes', courseId] });
      onOpenChange(false);
      setName(''); setDays([]); setTime(''); setMeetingLink(''); setZoomLicenseId('');
      toast({ title: 'Class created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleDay = (d: string) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Class</DialogTitle>
          <DialogDescription>Add a new class to this course</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Class Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Batch A - Evening" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Schedule Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <label key={d} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox checked={days.includes(d)} onCheckedChange={() => toggleDay(d)} />
                  {d.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Time</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (min)</Label>
              <Input type="number" min={15} max={180} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Seats</Label>
              <Input type="number" min={1} value={maxSeats} onChange={e => setMaxSeats(parseInt(e.target.value) || 30)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Timezone</Label>
            <Input value={timezone} onChange={e => setTimezone(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Class Type</Label>
            <Select value={classType} onValueChange={setClassType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLASS_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meeting</p>

          <div className="space-y-1.5">
            <Label className="text-xs">Zoom Room (from pool)</Label>
            <Select value={zoomLicenseId} onValueChange={v => { setZoomLicenseId(v); setMeetingLink(''); }}>
              <SelectTrigger><SelectValue placeholder="Select Zoom room or enter manually" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (manual link)</SelectItem>
                {zoomLicenses.map((z: any) => (
                  <SelectItem key={z.id} value={z.id}>{z.label || z.zoom_email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(!zoomLicenseId || zoomLicenseId === 'none') && (
            <div className="space-y-1.5">
              <Label className="text-xs">Meeting Link (manual)</Label>
              <Input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://zoom.us/j/..." />
            </div>
          )}

          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fee</p>

          <div className="flex items-center gap-3">
            <Switch checked={isVolunteer} onCheckedChange={setIsVolunteer} />
            <Label className="text-xs">Volunteer (no fees / invoices)</Label>
          </div>
          {!isVolunteer && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fee Amount</Label>
                <Input type="number" min={0} value={feeAmount} onChange={e => setFeeAmount(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Select value={feeCurrency} onValueChange={setFeeCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PKR">PKR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create Class'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══ CLASS DETAIL VIEW ═══
function ClassDetail({ cls, courseId, onBack }: { cls: any; courseId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [staffOpen, setStaffOpen] = useState(false);
  const [studentOpen, setStudentOpen] = useState(false);

  // Staff
  const { data: staff = [] } = useQuery({
    queryKey: ['class-staff', cls.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_class_staff')
        .select('*, profile:user_id(id, full_name, email)')
        .eq('class_id', cls.id);
      if (error) throw error;
      return data || [];
    },
  });

  // Students
  const { data: students = [] } = useQuery({
    queryKey: ['class-students', cls.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_class_students')
        .select('*, profile:student_id(id, full_name, email)')
        .eq('class_id', cls.id);
      if (error) throw error;
      return data || [];
    },
  });

  // Course enrolled students for adding
  const { data: enrolledStudents = [] } = useQuery({
    queryKey: ['course-enrolled', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('student_id, profile:student_id(id, full_name, email)')
        .eq('course_id', courseId)
        .eq('status', 'active');
      return data || [];
    },
  });

  // Staff list for picker
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      return data || [];
    },
  });

  const deleteClass = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_classes').delete().eq('id', cls.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-classes', courseId] });
      onBack();
      toast({ title: 'Class deleted' });
    },
  });

  const removeStaff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_class_staff').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['class-staff', cls.id] }); toast({ title: 'Staff removed' }); },
  });

  const removeStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_class_students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['class-students', cls.id] }); toast({ title: 'Student removed' }); },
  });

  // Generate upcoming sessions from schedule
  const upcomingSessions = React.useMemo(() => {
    if (!cls.schedule_days?.length || !cls.schedule_time) return [];
    const sessions: { date: Date; day: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      if ((cls.schedule_days as string[]).includes(dayName)) {
        sessions.push({ date: d, day: dayName });
      }
    }
    return sessions.slice(0, 12);
  }, [cls.schedule_days, cls.schedule_time]);

  const teachers = staff.filter((s: any) => s.staff_role === 'teacher');
  const moderators = staff.filter((s: any) => s.staff_role === 'moderator');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">{cls.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[10px]">{cls.class_type}</Badge>
            {cls.is_volunteer && <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">Volunteer</Badge>}
          </div>
        </div>
        <Button variant="destructive" size="sm" className="gap-1" onClick={() => { if (confirm('Delete this class?')) deleteClass.mutate(); }}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      {/* Fee Section */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Fee
          </h4>
          {cls.is_volunteer ? (
            <p className="text-sm text-emerald-600">Volunteer class — no fees or invoices generated</p>
          ) : (
            <p className="text-sm font-medium">{cls.fee_currency} {cls.fee_amount} per student</p>
          )}
        </CardContent>
      </Card>

      {/* Staff Section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Staff
            </h4>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setStaffOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Staff
            </Button>
          </div>

          {teachers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Teachers</p>
              {teachers.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{(s as any).profile?.full_name || 'Unknown'}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      {(s.subjects || []).map((sub: string) => <Badge key={sub} variant="secondary" className="text-[10px]">{sub}</Badge>)}
                      <Badge variant="outline" className={cn("text-[10px]", s.payout_type === 'volunteer' && "text-emerald-600 border-emerald-200")}>
                        {s.payout_type}
                      </Badge>
                    </div>
                  </div>
                  <button onClick={() => removeStaff.mutate(s.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {moderators.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Moderators</p>
              {moderators.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30">
                  <p className="text-sm font-medium">{(s as any).profile?.full_name || 'Unknown'}</p>
                  <button onClick={() => removeStaff.mutate(s.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {staff.length === 0 && <p className="text-xs text-muted-foreground">No staff assigned</p>}
        </CardContent>
      </Card>

      {/* Schedule Calendar */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Upcoming Sessions (4 weeks)
          </h4>
          {upcomingSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No schedule configured</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {upcomingSessions.map((s, i) => (
                <div key={i} className="text-center py-2 px-1 rounded-md bg-muted/30 border">
                  <p className="text-[10px] text-muted-foreground">{s.day.slice(0, 3)}</p>
                  <p className="text-xs font-medium">{format(s.date, 'MMM d')}</p>
                  <p className="text-[10px] text-muted-foreground">{cls.schedule_time?.slice(0, 5)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students Section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Students ({students.length}/{cls.max_seats})
            </h4>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setStudentOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add Student
            </Button>
          </div>
          {students.length === 0 ? (
            <p className="text-xs text-muted-foreground">No students enrolled in this class</p>
          ) : (
            <div className="space-y-1">
              {students.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{(s as any).profile?.full_name || 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground">{(s as any).profile?.email}</p>
                  </div>
                  <button onClick={() => removeStudent.mutate(s.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddStaffDialog open={staffOpen} onOpenChange={setStaffOpen} classId={cls.id} staffList={staffList} existingStaffIds={staff.map((s: any) => s.user_id)} />
      <AddStudentDialog open={studentOpen} onOpenChange={setStudentOpen} classId={cls.id} enrolledStudents={enrolledStudents} existingStudentIds={students.map((s: any) => s.student_id)} />
    </div>
  );
}

// ═══ ADD STAFF DIALOG ═══
function AddStaffDialog({ open, onOpenChange, classId, staffList, existingStaffIds }: {
  open: boolean; onOpenChange: (v: boolean) => void; classId: string; staffList: any[]; existingStaffIds: string[];
}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('teacher');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [payoutType, setPayoutType] = useState('per_session');
  const [search, setSearch] = useState('');

  const SUBJECT_OPTIONS = ['Quran Recitation', 'Tajweed', 'Hifz', 'Qaida', 'Arabic', 'Islamic Studies'];
  const filtered = staffList.filter((s: any) =>
    !existingStaffIds.includes(s.id) &&
    (s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 20);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_class_staff').insert({
        class_id: classId,
        user_id: userId,
        staff_role: role,
        subjects: role === 'teacher' ? subjects : [],
        payout_type: role === 'teacher' ? payoutType : 'volunteer',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-staff', classId] });
      onOpenChange(false);
      setUserId(''); setSubjects([]); setSearch('');
      toast({ title: 'Staff added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Staff</DialogTitle>
          <DialogDescription>Assign a teacher or moderator to this class</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Search Staff</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." />
            <div className="max-h-32 overflow-y-auto border rounded-md">
              {filtered.map((s: any) => (
                <button key={s.id} onClick={() => setUserId(s.id)}
                  className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50", userId === s.id && "bg-primary/10 text-primary")}>
                  {s.full_name || s.email}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>}
            </div>
          </div>
          {role === 'teacher' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Subjects</Label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map(sub => (
                    <label key={sub} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox checked={subjects.includes(sub)} onCheckedChange={() =>
                        setSubjects(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : [...prev, sub])
                      } />
                      {sub}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payout Type</Label>
                <Select value={payoutType} onValueChange={setPayoutType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYOUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => add.mutate()} disabled={!userId || add.isPending}>
            {add.isPending ? 'Adding…' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══ ADD STUDENT DIALOG ═══
function AddStudentDialog({ open, onOpenChange, classId, enrolledStudents, existingStudentIds }: {
  open: boolean; onOpenChange: (v: boolean) => void; classId: string; enrolledStudents: any[]; existingStudentIds: string[];
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);

  const available = enrolledStudents.filter((e: any) => !existingStudentIds.includes(e.student_id));

  const add = useMutation({
    mutationFn: async () => {
      const rows = selected.map(sid => ({ class_id: classId, student_id: sid }));
      const { error } = await supabase.from('course_class_students').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-students', classId] });
      onOpenChange(false);
      setSelected([]);
      toast({ title: `${selected.length} student(s) added` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Students</DialogTitle>
          <DialogDescription>Select from enrolled course students</DialogDescription>
        </DialogHeader>
        <div className="max-h-60 overflow-y-auto border rounded-md">
          {available.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">All enrolled students are already in this class</p>
          ) : available.map((e: any) => (
            <label key={e.student_id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
              <Checkbox checked={selected.includes(e.student_id)} onCheckedChange={() =>
                setSelected(prev => prev.includes(e.student_id) ? prev.filter(x => x !== e.student_id) : [...prev, e.student_id])
              } />
              <span className="text-sm">{e.profile?.full_name || e.profile?.email || e.student_id}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => add.mutate()} disabled={selected.length === 0 || add.isPending}>
            {add.isPending ? 'Adding…' : `Add ${selected.length} Student(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
