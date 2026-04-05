import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Clock, User, Users, BookOpen, Layers } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

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
}

interface TeacherLane {
  teacherId: string;
  teacherName: string;
  slots: SlotEntry[];
}

// Time grid constants
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const HOUR_HEIGHT = 64; // px per hour
const SLOT_MIN_HEIGHT = 28;

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

// Pastel color palette for teacher lanes
const LANE_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800', accent: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', accent: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800', accent: 'bg-violet-500', badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', accent: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800', accent: 'bg-rose-500', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-200 dark:border-cyan-800', accent: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  { bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', accent: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { bg: 'bg-teal-50 dark:bg-teal-950/40', border: 'border-teal-200 dark:border-teal-800', accent: 'bg-teal-500', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' },
];

interface DailySlotCalendarProps {
  assignments: Assignment[];
  schedules: Schedule[];
}

export function DailySlotCalendar({ assignments, schedules }: DailySlotCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeView, setTimeView] = useState<'teacher' | 'student'>('teacher');

  const dayName = format(selectedDate, 'EEEE').toLowerCase();
  const isToday = format(new Date(), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  // Get schedules for the selected day
  const daySchedules = useMemo(() => {
    return schedules.filter(s => s.day_of_week === dayName && s.is_active);
  }, [schedules, dayName]);

  // Build teacher lanes
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

    // Sort slots within each lane
    for (const lane of laneMap.values()) {
      lane.slots.sort((a, b) => a.startMinutes - b.startMinutes);
    }

    return Array.from(laneMap.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  }, [daySchedules, assignments, timeView]);

  // Determine visible hour range (auto-zoom to occupied hours with padding)
  const { visibleStart, visibleEnd } = useMemo(() => {
    if (teacherLanes.length === 0) {
      return { visibleStart: 8 * 60, visibleEnd: 22 * 60 }; // default 8am-10pm
    }
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const lane of teacherLanes) {
      for (const slot of lane.slots) {
        minStart = Math.min(minStart, slot.startMinutes);
        maxEnd = Math.max(maxEnd, slot.endMinutes);
      }
    }
    // Add 1-hour padding
    const start = Math.max(0, Math.floor((minStart - 60) / 60) * 60);
    const end = Math.min(24 * 60, Math.ceil((maxEnd + 60) / 60) * 60);
    return { visibleStart: start, visibleEnd: Math.max(end, start + 3 * 60) };
  }, [teacherLanes]);

  const totalMinutes = visibleEnd - visibleStart;
  const totalHeight = (totalMinutes / 60) * HOUR_HEIGHT;

  // Generate hour markers
  const hourMarkers = useMemo(() => {
    const markers: number[] = [];
    for (let m = visibleStart; m < visibleEnd; m += 60) {
      markers.push(m);
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

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(d => subDays(d, 1))}>
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
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(d => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeView} onValueChange={(v: 'teacher' | 'student') => setTimeView(v)}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher">Teacher Time</SelectItem>
              <SelectItem value="student">Student Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 flex items-center gap-3 bg-card border">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{totalTeachers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Teachers</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3 bg-card border">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <User className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{totalStudents}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Students</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3 bg-card border">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Layers className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{totalSlots}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Classes</p>
          </div>
        </Card>
      </div>

      {/* Timeline Grid */}
      {teacherLanes.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h4 className="font-semibold text-muted-foreground">No classes on {format(selectedDate, 'EEEE')}</h4>
          <p className="text-sm text-muted-foreground/70 mt-1">Navigate to a day with scheduled classes</p>
        </Card>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          {/* Teacher Lane Headers */}
          <div className="flex border-b sticky top-0 z-20 bg-card">
            {/* Time gutter */}
            <div className="w-16 sm:w-20 shrink-0 border-r bg-muted/30 p-2 flex items-center justify-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            {/* Teacher columns */}
            {teacherLanes.map((lane, idx) => {
              const color = LANE_COLORS[idx % LANE_COLORS.length];
              return (
                <div
                  key={lane.teacherId}
                  className={`flex-1 min-w-[140px] border-r last:border-r-0 p-3 ${color.bg}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${color.accent} shrink-0`} />
                    <p className="text-sm font-semibold text-foreground truncate">{lane.teacherName}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{lane.slots.length} class{lane.slots.length !== 1 ? 'es' : ''}</p>
                </div>
              );
            })}
          </div>

          {/* Scrollable timeline body */}
          <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: '60vh' }}>
            <div className="flex relative" style={{ height: totalHeight }}>
              {/* Time gutter */}
              <div className="w-16 sm:w-20 shrink-0 border-r relative bg-muted/10">
                {hourMarkers.map(m => (
                  <div
                    key={m}
                    className="absolute left-0 right-0 flex items-start justify-end pr-2"
                    style={{ top: ((m - visibleStart) / totalMinutes) * totalHeight }}
                  >
                    <span className="text-[11px] font-medium text-muted-foreground -translate-y-1/2 tabular-nums">
                      {minutesToTime12h(m)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Teacher columns */}
              {teacherLanes.map((lane, laneIdx) => {
                const color = LANE_COLORS[laneIdx % LANE_COLORS.length];
                return (
                  <div key={lane.teacherId} className="flex-1 min-w-[140px] border-r last:border-r-0 relative">
                    {/* Hour gridlines */}
                    {hourMarkers.map(m => (
                      <div
                        key={m}
                        className="absolute left-0 right-0 border-t border-border/40"
                        style={{ top: ((m - visibleStart) / totalMinutes) * totalHeight }}
                      />
                    ))}
                    {/* Half-hour gridlines */}
                    {hourMarkers.map(m => (
                      <div
                        key={`half-${m}`}
                        className="absolute left-0 right-0 border-t border-border/20 border-dashed"
                        style={{ top: ((m + 30 - visibleStart) / totalMinutes) * totalHeight }}
                      />
                    ))}

                    {/* Slot blocks */}
                    {lane.slots.map(slot => {
                      const top = ((slot.startMinutes - visibleStart) / totalMinutes) * totalHeight;
                      const height = Math.max(SLOT_MIN_HEIGHT, (slot.schedule.duration_minutes / totalMinutes) * totalHeight);

                      return (
                        <TooltipProvider key={slot.schedule.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`absolute left-1 right-1 rounded-lg border ${color.border} ${color.bg} p-2 cursor-pointer
                                  hover:shadow-md hover:scale-[1.02] transition-all duration-150 overflow-hidden group`}
                                style={{ top, height }}
                              >
                                <div className="flex flex-col h-full justify-between">
                                  <div>
                                    <p className="text-xs font-bold text-foreground leading-tight truncate">
                                      {slot.assignment.student_name}
                                    </p>
                                    {slot.assignment.subject_name && (
                                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                                        <BookOpen className="h-2.5 w-2.5 shrink-0" />
                                        {slot.assignment.subject_name}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${color.badge} border-0`}>
                                      {minutesToTime12h(slot.startMinutes)}
                                    </Badge>
                                    <span className="text-[9px] text-muted-foreground">{slot.schedule.duration_minutes}m</span>
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[220px]">
                              <div className="space-y-1">
                                <p className="font-semibold text-sm">{slot.assignment.student_name}</p>
                                <p className="text-xs text-muted-foreground">Teacher: {slot.assignment.teacher_name}</p>
                                {slot.assignment.subject_name && (
                                  <p className="text-xs text-muted-foreground">Subject: {slot.assignment.subject_name}</p>
                                )}
                                <div className="border-t pt-1 mt-1">
                                  <p className="text-xs">
                                    <span className="font-medium">Time:</span> {minutesToTime12h(slot.startMinutes)} – {minutesToTime12h(slot.endMinutes)}
                                  </p>
                                  <p className="text-xs">
                                    <span className="font-medium">Duration:</span> {slot.schedule.duration_minutes} min
                                  </p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                );
              })}

              {/* Now line */}
              {showNowLine && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: nowPosition }}
                >
                  <div className="flex items-center">
                    <div className="w-16 sm:w-20 shrink-0 flex justify-end pr-1">
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1 rounded">NOW</span>
                    </div>
                    <div className="flex-1 h-[2px] bg-destructive/70" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
