import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Clock, User, Users, BookOpen, Layers, Pencil, AlertTriangle, Video, Wifi } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK_LOWER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface Assignment {
  id: string;
  teacher_id: string;
  student_id: string;
  teacher_name: string;
  student_name: string;
  subject_name: string | null;
}

interface Schedule {
  id: string;
  assignment_id: string;
  day_of_week: string;
  teacher_local_time: string;
  student_local_time: string;
  duration_minutes: number;
  is_active: boolean;
}

interface SlotEntry {
  schedule: Schedule;
  assignment: Assignment;
  startMinutes: number;
  endMinutes: number;
  hasConflict?: boolean;
  conflictWith?: string;
}

interface TeacherLane {
  teacherId: string;
  teacherName: string;
  slots: SlotEntry[];
}

// Time grid constants
const HOUR_HEIGHT = 72; // px per hour — slightly taller for readability
const SLOT_MIN_HEIGHT = 32;

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minutesToTime12h(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Subject-based color palette
function getSubjectColor(subjectName: string | null): {
  bg: string; border: string; text: string; badge: string; gradient: string; ring: string;
} {
  const name = (subjectName || '').toLowerCase();
  if (name.includes('nazra') || name.includes('quran reading'))
    return { bg: 'bg-emerald-50 dark:bg-emerald-950/50', border: 'border-emerald-400 dark:border-emerald-600', text: 'text-emerald-800 dark:text-emerald-200', badge: 'bg-emerald-500', gradient: 'from-emerald-500/20 to-emerald-500/5', ring: 'ring-emerald-400/30' };
  if (name.includes('qaida') || name.includes('noorani'))
    return { bg: 'bg-blue-50 dark:bg-blue-950/50', border: 'border-blue-400 dark:border-blue-600', text: 'text-blue-800 dark:text-blue-200', badge: 'bg-blue-500', gradient: 'from-blue-500/20 to-blue-500/5', ring: 'ring-blue-400/30' };
  if (name.includes('hifz') || name.includes('memoriz'))
    return { bg: 'bg-violet-50 dark:bg-violet-950/50', border: 'border-violet-400 dark:border-violet-600', text: 'text-violet-800 dark:text-violet-200', badge: 'bg-violet-500', gradient: 'from-violet-500/20 to-violet-500/5', ring: 'ring-violet-400/30' };
  if (name.includes('arabic') || name.includes('nahw') || name.includes('sarf'))
    return { bg: 'bg-amber-50 dark:bg-amber-950/50', border: 'border-amber-400 dark:border-amber-600', text: 'text-amber-800 dark:text-amber-200', badge: 'bg-amber-500', gradient: 'from-amber-500/20 to-amber-500/5', ring: 'ring-amber-400/30' };
  if (name.includes('tarbiyah') || name.includes('islamic') || name.includes('aqeedah'))
    return { bg: 'bg-teal-50 dark:bg-teal-950/50', border: 'border-teal-400 dark:border-teal-600', text: 'text-teal-800 dark:text-teal-200', badge: 'bg-teal-500', gradient: 'from-teal-500/20 to-teal-500/5', ring: 'ring-teal-400/30' };
  if (name.includes('tajweed'))
    return { bg: 'bg-rose-50 dark:bg-rose-950/50', border: 'border-rose-400 dark:border-rose-600', text: 'text-rose-800 dark:text-rose-200', badge: 'bg-rose-500', gradient: 'from-rose-500/20 to-rose-500/5', ring: 'ring-rose-400/30' };
  return { bg: 'bg-slate-50 dark:bg-slate-950/50', border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-800 dark:text-slate-200', badge: 'bg-slate-500', gradient: 'from-slate-500/20 to-slate-500/5', ring: 'ring-slate-400/30' };
}

// Teacher column header colors
const LANE_HEADER_COLORS = [
  'from-blue-500/10 to-blue-500/5',
  'from-emerald-500/10 to-emerald-500/5',
  'from-violet-500/10 to-violet-500/5',
  'from-amber-500/10 to-amber-500/5',
  'from-rose-500/10 to-rose-500/5',
  'from-cyan-500/10 to-cyan-500/5',
  'from-orange-500/10 to-orange-500/5',
  'from-teal-500/10 to-teal-500/5',
];

const LANE_ACCENT_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
];

interface DailySlotCalendarProps {
  assignments: Assignment[];
  schedules: Schedule[];
  onEditSchedule?: (scheduleId: string) => void;
}

export function DailySlotCalendar({ assignments, schedules, onEditSchedule }: DailySlotCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeView, setTimeView] = useState<'teacher' | 'student'>('teacher');
  const [selectedSlot, setSelectedSlot] = useState<SlotEntry | null>(null);

  const dayName = format(selectedDate, 'EEEE').toLowerCase();
  const isToday = format(new Date(), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  // Fetch Zoom license availability
  const { data: zoomLicenses } = useQuery({
    queryKey: ['zoom-license-status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('zoom_licenses')
        .select('id, status')
        .eq('is_active', true);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const totalLicenses = zoomLicenses?.length || 0;
  const availableLicenses = zoomLicenses?.filter(l => l.status === 'available').length || 0;
  const busyLicenses = totalLicenses - availableLicenses;

  // Get schedules for the selected day
  const daySchedules = useMemo(() => {
    return schedules.filter(s => s.day_of_week === dayName && s.is_active);
  }, [schedules, dayName]);

  // Build teacher lanes with conflict detection
  const teacherLanes = useMemo(() => {
    const laneMap = new Map<string, TeacherLane>();

    for (const schedule of daySchedules) {
      const assignment = assignments.find(a => a.id === schedule.assignment_id);
      if (!assignment) continue;

      const time = timeView === 'teacher' ? schedule.teacher_local_time : schedule.student_local_time;
      const startMin = timeToMinutes(time);
      const endMin = startMin + schedule.duration_minutes;

      const entry: SlotEntry = { schedule, assignment, startMinutes: startMin, endMinutes: endMin };

      if (!laneMap.has(assignment.teacher_id)) {
        laneMap.set(assignment.teacher_id, {
          teacherId: assignment.teacher_id,
          teacherName: assignment.teacher_name,
          slots: [],
        });
      }
      laneMap.get(assignment.teacher_id)!.slots.push(entry);
    }

    // Detect conflicts within each teacher lane
    for (const lane of laneMap.values()) {
      lane.slots.sort((a, b) => a.startMinutes - b.startMinutes);
      for (let i = 0; i < lane.slots.length; i++) {
        for (let j = i + 1; j < lane.slots.length; j++) {
          const a = lane.slots[i];
          const b = lane.slots[j];
          if (a.endMinutes > b.startMinutes && a.startMinutes < b.endMinutes) {
            a.hasConflict = true;
            a.conflictWith = b.assignment.student_name;
            b.hasConflict = true;
            b.conflictWith = a.assignment.student_name;
          }
        }
      }
    }

    return Array.from(laneMap.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  }, [daySchedules, assignments, timeView]);

  // Determine visible hour range (auto-fit)
  const { visibleStart, visibleEnd } = useMemo(() => {
    if (teacherLanes.length === 0) {
      return { visibleStart: 8 * 60, visibleEnd: 22 * 60 };
    }
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const lane of teacherLanes) {
      for (const slot of lane.slots) {
        minStart = Math.min(minStart, slot.startMinutes);
        maxEnd = Math.max(maxEnd, slot.endMinutes);
      }
    }
    const start = Math.max(0, Math.floor((minStart - 30) / 60) * 60);
    const end = Math.min(24 * 60, Math.ceil((maxEnd + 30) / 60) * 60);
    return { visibleStart: start, visibleEnd: Math.max(end, start + 3 * 60) };
  }, [teacherLanes]);

  const totalMinutes = visibleEnd - visibleStart;
  const totalHeight = (totalMinutes / 60) * HOUR_HEIGHT;

  const hourMarkers = useMemo(() => {
    const markers: number[] = [];
    for (let m = visibleStart; m < visibleEnd; m += 60) markers.push(m);
    return markers;
  }, [visibleStart, visibleEnd]);

  const quarterMarkers = useMemo(() => {
    const markers: number[] = [];
    for (let m = visibleStart; m < visibleEnd; m += 15) {
      if (m % 60 !== 0) markers.push(m);
    }
    return markers;
  }, [visibleStart, visibleEnd]);

  // Current time indicator
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine = isToday && currentMinutes >= visibleStart && currentMinutes <= visibleEnd;
  const nowPosition = ((currentMinutes - visibleStart) / totalMinutes) * totalHeight;

  // Stats
  const totalSlots = daySchedules.length;
  const totalTeachers = teacherLanes.length;
  const totalStudents = new Set(daySchedules.map(s => {
    const a = assignments.find(x => x.id === s.assignment_id);
    return a?.student_id;
  }).filter(Boolean)).size;
  const conflictCount = teacherLanes.reduce((sum, l) => sum + l.slots.filter(s => s.hasConflict).length, 0);

  // Subject legend
  const subjectsInView = useMemo(() => {
    const set = new Set<string>();
    teacherLanes.forEach(l => l.slots.forEach(s => {
      if (s.assignment.subject_name) set.add(s.assignment.subject_name);
    }));
    return Array.from(set).sort();
  }, [teacherLanes]);

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSelectedDate(d => subDays(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              {format(selectedDate, 'EEEE')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {format(selectedDate, 'MMMM d, yyyy')}
              {isToday && <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">Today</Badge>}
            </p>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSelectedDate(d => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" className="text-xs h-8 rounded-lg" onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeView} onValueChange={(v: 'teacher' | 'student') => setTimeView(v)}>
            <SelectTrigger className="h-9 w-[160px] text-xs rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher">Teacher Time</SelectItem>
              <SelectItem value="student">Student Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats + Zoom Room Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 flex items-center gap-3 bg-card border rounded-xl">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{totalTeachers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Teachers</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3 bg-card border rounded-xl">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <User className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{totalStudents}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Students</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3 bg-card border rounded-xl">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Layers className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{totalSlots}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Classes</p>
          </div>
        </Card>
        {/* Zoom Room Availability */}
        <Card className={cn(
          "p-3 flex items-center gap-3 border rounded-xl",
          availableLicenses === 0 && totalLicenses > 0 ? "bg-destructive/5 border-destructive/20" : "bg-card"
        )}>
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            availableLicenses > 0 ? "bg-green-500/10" : totalLicenses > 0 ? "bg-destructive/10" : "bg-muted"
          )}>
            <Video className={cn(
              "h-5 w-5",
              availableLicenses > 0 ? "text-green-600" : totalLicenses > 0 ? "text-destructive" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-2xl font-bold text-foreground leading-none">{availableLicenses}</p>
              <span className="text-xs text-muted-foreground">/ {totalLicenses}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              Zoom Rooms
              {busyLicenses > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                  <Wifi className="h-2.5 w-2.5" />
                  {busyLicenses} live
                </span>
              )}
            </p>
          </div>
        </Card>
      </div>

      {/* Conflict Warning */}
      {conflictCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">
            {conflictCount / 2} schedule conflict{conflictCount > 2 ? 's' : ''} detected — overlapping time slots shown with red border
          </p>
        </div>
      )}

      {/* Subject Legend */}
      {subjectsInView.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Subjects:</span>
          {subjectsInView.map(subj => {
            const color = getSubjectColor(subj);
            return (
              <Badge key={subj} variant="outline" className={`text-[10px] px-2 py-0.5 rounded-lg ${color.bg} ${color.border} ${color.text}`}>
                <div className={`w-2 h-2 rounded-full ${color.badge} mr-1.5`} />
                {subj}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Timeline Grid */}
      {teacherLanes.length === 0 ? (
        <Card className="p-12 text-center border-dashed rounded-xl">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h4 className="font-semibold text-muted-foreground">No classes on {format(selectedDate, 'EEEE')}</h4>
          <p className="text-sm text-muted-foreground/70 mt-1">Navigate to a day with scheduled classes</p>
        </Card>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
          {/* Teacher Lane Headers */}
          <div className="flex border-b sticky top-0 z-20 bg-card">
            {/* Time gutter */}
            <div className="w-[76px] shrink-0 border-r bg-muted/30 p-2 flex items-center justify-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            {/* Teacher columns */}
            {teacherLanes.map((lane, idx) => {
              const laneConflicts = lane.slots.filter(s => s.hasConflict).length;
              return (
                <div
                  key={lane.teacherId}
                  className={`flex-1 min-w-[150px] border-r last:border-r-0 p-3 bg-gradient-to-b ${LANE_HEADER_COLORS[idx % LANE_HEADER_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-9 w-9 rounded-xl ${LANE_ACCENT_COLORS[idx % LANE_ACCENT_COLORS.length]} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                      {lane.teacherName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{lane.teacherName}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">{lane.slots.length} class{lane.slots.length !== 1 ? 'es' : ''}</span>
                        {laneConflicts > 0 && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                            {laneConflicts / 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable timeline body */}
          <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: '65vh' }}>
            <div className="flex relative" style={{ height: totalHeight }}>
              {/* Time gutter */}
              <div className="w-[76px] shrink-0 border-r relative bg-muted/5">
                {hourMarkers.map(m => (
                  <div
                    key={m}
                    className="absolute left-0 right-0 flex items-start justify-end pr-2.5"
                    style={{ top: ((m - visibleStart) / totalMinutes) * totalHeight }}
                  >
                    <span className="text-[11px] font-semibold text-foreground -translate-y-1/2 tabular-nums tracking-tight">
                      {minutesToTime12h(m)}
                    </span>
                  </div>
                ))}
                {/* 30-min labels */}
                {quarterMarkers.filter(m => m % 30 === 0).map(m => (
                  <div
                    key={`q-${m}`}
                    className="absolute left-0 right-0 flex items-start justify-end pr-2.5"
                    style={{ top: ((m - visibleStart) / totalMinutes) * totalHeight }}
                  >
                    <span className="text-[9px] text-muted-foreground/50 -translate-y-1/2 tabular-nums">
                      {minutesToTime12h(m)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Teacher columns */}
              {teacherLanes.map((lane) => (
                <div key={lane.teacherId} className="flex-1 min-w-[150px] border-r last:border-r-0 relative">
                  {/* Hour gridlines */}
                  {hourMarkers.map(m => (
                    <div
                      key={m}
                      className="absolute left-0 right-0 border-t border-border/40"
                      style={{ top: ((m - visibleStart) / totalMinutes) * totalHeight }}
                    />
                  ))}
                  {/* 30-min gridlines */}
                  {hourMarkers.map(m => (
                    <div
                      key={`half-${m}`}
                      className="absolute left-0 right-0 border-t border-border/20 border-dashed"
                      style={{ top: ((m + 30 - visibleStart) / totalMinutes) * totalHeight }}
                    />
                  ))}
                  {/* 15-min gridlines */}
                  {quarterMarkers.filter(m => m % 30 !== 0).map(m => (
                    <div
                      key={`q15-${m}`}
                      className="absolute left-0 right-0 border-t border-border/8"
                      style={{ top: ((m - visibleStart) / totalMinutes) * totalHeight }}
                    />
                  ))}

                  {/* Slot blocks */}
                  {lane.slots.map(slot => {
                    const top = ((slot.startMinutes - visibleStart) / totalMinutes) * totalHeight;
                    const height = Math.max(SLOT_MIN_HEIGHT, (slot.schedule.duration_minutes / totalMinutes) * totalHeight);
                    const color = getSubjectColor(slot.assignment.subject_name);

                    return (
                      <TooltipProvider key={slot.schedule.id} delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "absolute left-1.5 right-1.5 rounded-xl border-l-[3px] p-2 cursor-pointer overflow-hidden group transition-all duration-150",
                                "hover:shadow-lg hover:scale-[1.02] hover:z-10",
                                color.border, color.bg,
                                `bg-gradient-to-r ${color.gradient}`,
                                slot.hasConflict && "ring-2 ring-destructive/50 border-l-destructive animate-pulse"
                              )}
                              style={{ top, height }}
                              onClick={() => setSelectedSlot(slot)}
                            >
                              {/* Conflict indicator */}
                              {slot.hasConflict && (
                                <div className="absolute top-1 right-1 z-10">
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                </div>
                              )}

                              <div className="flex flex-col h-full justify-between">
                                <div>
                                  <p className={cn("text-xs font-bold leading-tight truncate", color.text)}>
                                    {slot.assignment.student_name}
                                  </p>
                                  {slot.assignment.subject_name && height > 44 && (
                                    <p className="text-[10px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                                      <div className={`w-1.5 h-1.5 rounded-full ${color.badge} shrink-0`} />
                                      {slot.assignment.subject_name}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className={cn("text-[9px] font-medium tabular-nums opacity-80", color.text)}>
                                    {minutesToTime12h(slot.startMinutes)}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground">{slot.schedule.duration_minutes}m</span>
                                </div>
                              </div>
                              {/* Edit icon on hover */}
                              {!slot.hasConflict && (
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[240px] p-3">
                            <div className="space-y-1.5">
                              <p className="font-semibold text-sm">{slot.assignment.student_name}</p>
                              <p className="text-xs text-muted-foreground">Teacher: {slot.assignment.teacher_name}</p>
                              {slot.assignment.subject_name && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <div className={`w-2 h-2 rounded-full ${color.badge}`} />
                                  {slot.assignment.subject_name}
                                </div>
                              )}
                              <div className="border-t pt-1.5 mt-1.5 space-y-0.5">
                                <p className="text-xs">
                                  <span className="font-medium">Time:</span> {minutesToTime12h(slot.startMinutes)} – {minutesToTime12h(slot.endMinutes)}
                                </p>
                                <p className="text-xs">
                                  <span className="font-medium">Duration:</span> {slot.schedule.duration_minutes} min
                                </p>
                              </div>
                              {slot.hasConflict && (
                                <div className="border-t pt-1.5 mt-1.5">
                                  <p className="text-xs text-destructive font-medium flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Conflicts with {slot.conflictWith}
                                  </p>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              ))}

              {/* Now line */}
              {showNowLine && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: nowPosition }}
                >
                  <div className="flex items-center">
                    <div className="w-[76px] shrink-0 flex justify-end pr-1">
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-lg">NOW</span>
                    </div>
                    <div className="flex-1 h-[2px] bg-destructive/60 relative">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-destructive shadow-sm shadow-destructive/30" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slot Detail Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={() => setSelectedSlot(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Class Details
              {selectedSlot?.hasConflict && (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Conflict
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              {selectedSlot.hasConflict && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">
                    This slot overlaps with <strong>{selectedSlot.conflictWith}</strong>'s class
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Student</p>
                  <p className="text-sm font-semibold">{selectedSlot.assignment.student_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Teacher</p>
                  <p className="text-sm font-semibold">{selectedSlot.assignment.teacher_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Subject</p>
                  <div className="flex items-center gap-1.5">
                    {selectedSlot.assignment.subject_name && (
                      <div className={`w-2.5 h-2.5 rounded-full ${getSubjectColor(selectedSlot.assignment.subject_name).badge}`} />
                    )}
                    <p className="text-sm font-semibold">{selectedSlot.assignment.subject_name || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Duration</p>
                  <p className="text-sm font-semibold">{selectedSlot.schedule.duration_minutes} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Teacher Time</p>
                  <p className="text-sm font-semibold tabular-nums">{minutesToTime12h(timeToMinutes(selectedSlot.schedule.teacher_local_time))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Student Time</p>
                  <p className="text-sm font-semibold tabular-nums">{minutesToTime12h(timeToMinutes(selectedSlot.schedule.student_local_time))}</p>
                </div>
              </div>
              {onEditSchedule && (
                <Button className="w-full gap-2 rounded-xl" onClick={() => { onEditSchedule(selectedSlot.schedule.id); setSelectedSlot(null); }}>
                  <Pencil className="h-4 w-4" />
                  Edit Schedule
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
