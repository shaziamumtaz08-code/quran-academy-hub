import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, User, GraduationCap, Users, BookOpen, Heart, Baby, Shield, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConnUserType = 'student' | 'teacher' | 'parent';
export type RoleFilter = 'all' | 'teacher' | 'student' | 'parent';

interface Props {
  userId: string;
  userType?: ConnUserType;
  roleFilter?: RoleFilter;
  compact?: boolean;
  className?: string;
}

/* ---------- Role pill colors (center node badges) ---------- */
const ROLE_PILL: Record<string, string> = {
  super_admin: 'bg-red-500 text-white',
  admin:       'bg-orange-500 text-white',
  teacher:     'bg-emerald-500 text-white',
  student:     'bg-sky-500 text-white',
  parent:      'bg-amber-500 text-white',
  examiner:    'bg-violet-500 text-white',
};
const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  examiner: 'Examiner',
};

/* ---------- Node styling ---------- */
type NodeKind = 'self' | 'teacher' | 'student' | 'parent' | 'sibling' | 'course' | 'class' | 'coteacher';

const NODE_STYLES: Record<NodeKind, { bg: string; border: string; text: string; icon: React.ComponentType<any> }> = {
  self:      { bg: '', border: '', text: '', icon: User },
  teacher:   { bg: 'bg-blue-500/10',    border: 'border-blue-500/50',    text: 'text-blue-700 dark:text-blue-300',       icon: GraduationCap },
  student:   { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-700 dark:text-emerald-300', icon: Users },
  parent:    { bg: 'bg-amber-500/10',   border: 'border-amber-500/50',   text: 'text-amber-700 dark:text-amber-300',     icon: Heart },
  sibling:   { bg: 'bg-violet-500/10',  border: 'border-violet-500/50',  text: 'text-violet-700 dark:text-violet-300',   icon: Baby },
  course:    { bg: 'bg-purple-500/10',  border: 'border-purple-500/50',  text: 'text-purple-700 dark:text-purple-300',   icon: BookOpen },
  class:     { bg: 'bg-purple-500/10',  border: 'border-purple-500/50',  text: 'text-purple-700 dark:text-purple-300',   icon: BookOpen },
  coteacher: { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/50',  text: 'text-indigo-700 dark:text-indigo-300',   icon: GraduationCap },
};

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  completed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  paused:    'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ended:     'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
  withdrawn: 'bg-muted text-muted-foreground',
};

/* ---------- Edge colors by relationship type ---------- */
const EDGE_COLORS = {
  teacher: 'hsl(217 91% 60%)',  // blue
  student: 'hsl(160 84% 39%)',  // green
  parent:  'hsl(38 92% 50%)',   // amber
  course:  'hsl(271 81% 56%)',  // purple
  sibling: 'hsl(262 83% 58%)',  // violet
};

interface PersonNodeData {
  kind: NodeKind;
  title: string;
  subtitle?: string;
  badge?: string;
  status?: string;
  roles?: string[];
  navUserId?: string;
  navUserType?: ConnUserType;
  sectionLabel?: string;
  sectionColor?: string;
}

function PersonNode({ data }: NodeProps<PersonNodeData>) {
  const isSelf = data.kind === 'self';
  const style = NODE_STYLES[data.kind];
  const Icon = style.icon;

  if (isSelf) {
    return (
      <div className="rounded-2xl px-5 py-4 min-w-[240px] max-w-[300px] shadow-2xl ring-4 ring-primary/30 bg-gradient-to-br from-primary via-primary to-primary/80 relative">
        <Handle type="target" position={Position.Top} className="!opacity-0" />
        <Handle type="target" position={Position.Left} className="!opacity-0" />
        <Handle type="target" position={Position.Right} className="!opacity-0" />
        <Handle type="source" position={Position.Top} className="!opacity-0" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <Handle type="source" position={Position.Left} className="!opacity-0" />
        <Handle type="source" position={Position.Right} className="!opacity-0" />
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2 shrink-0 bg-white/25">
            <User className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight text-base text-primary-foreground truncate">{data.title}</p>
            {data.subtitle && <p className="text-[11px] mt-0.5 opacity-80 text-primary-foreground truncate">{data.subtitle}</p>}
            {data.roles && data.roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {data.roles.map((r) => (
                  <span key={r} className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm', ROLE_PILL[r] || 'bg-white/25 text-primary-foreground')}>
                    {ROLE_LABEL[r] || r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border-2 shadow-md hover:shadow-lg hover:scale-[1.03] transition-all cursor-pointer px-3 py-2 min-w-[170px] max-w-[220px]', style.bg, style.border)}>
      {data.sectionLabel && (
        <div className="absolute -top-7 left-0 right-0 text-center">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md', style.bg, style.text)}>
            {data.sectionLabel}
          </span>
        </div>
      )}
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground/40 !w-2 !h-2" />
      <Handle type="target" position={Position.Right} className="!bg-muted-foreground/40 !w-2 !h-2" />
      <div className="flex items-start gap-2">
        <div className="rounded-md p-1.5 shrink-0 bg-background/80">
          <Icon className={cn('h-3.5 w-3.5', style.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold leading-tight truncate text-xs', style.text)}>{data.title}</p>
          {data.subtitle && <p className={cn('text-[10px] mt-0.5 leading-tight truncate opacity-80', style.text)}>{data.subtitle}</p>}
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {data.badge && <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded bg-background/70', style.text)}>{data.badge}</span>}
            {data.status && <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded capitalize', STATUS_BADGE[data.status] || 'bg-muted text-muted-foreground')}>{data.status}</span>}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40 !w-2 !h-2" />
      <Handle type="source" position={Position.Left} className="!bg-muted-foreground/40 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground/40 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { person: PersonNode };

/* ---------- Test data filter ---------- */
function isTestProfile(p: { full_name?: string | null; email?: string | null } | null | undefined): boolean {
  if (!p) return false;
  const name = (p.full_name || '').toLowerCase();
  const email = (p.email || '').toLowerCase();
  if (/\b(test|demo|sample)\b/.test(name)) return true;
  if (/^student\s*\d+$/i.test((p.full_name || '').trim())) return true;
  if (/^teacher\s*\d+$/i.test((p.full_name || '').trim())) return true;
  if (email.includes('test') || email.includes('demo')) return true;
  return false;
}

/* ---------- Data fetchers ---------- */
async function fetchAsTeacher(teacherId: string) {
  const [assignmentsRes, classesRes] = await Promise.all([
    supabase
      .from('student_teacher_assignments')
      .select('id, status, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, email), subject:subjects(name)')
      .eq('teacher_id', teacherId),
    supabase
      .from('course_class_staff')
      .select('class:course_classes(id, name, status, course:courses(name))')
      .eq('user_id', teacherId),
  ]);

  const classIds = (classesRes.data || []).map((c: any) => c.class?.id).filter(Boolean);
  let coteachers: Array<{ id: string; full_name: string; email?: string }> = [];
  if (classIds.length) {
    const { data: peers } = await supabase
      .from('course_class_staff')
      .select('user:profiles!course_class_staff_user_id_fkey(id, full_name, email)')
      .in('class_id', classIds)
      .neq('user_id', teacherId);
    const seen = new Set<string>();
    coteachers = (peers || [])
      .map((p: any) => p.user)
      .filter((u: any) => u && !isTestProfile(u) && !seen.has(u.id) && seen.add(u.id));
  }

  return {
    students: (assignmentsRes.data || [])
      .filter((a: any) => a.student && !isTestProfile(a.student))
      .map((a: any) => ({ id: a.student.id, name: a.student.full_name || 'Unknown', subject: a.subject?.name || null, status: a.status })),
    classes: (classesRes.data || [])
      .map((c: any) => ({ id: c.class?.id, name: c.class?.name, course: c.class?.course?.name, status: c.class?.status }))
      .filter((c: any) => c.id),
    coteachers,
  };
}

async function fetchAsStudent(studentId: string) {
  const [assignmentsRes, enrollmentsRes, classMembershipsRes] = await Promise.all([
    supabase
      .from('student_teacher_assignments')
      .select('id, status, teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name, email), subject:subjects(name)')
      .eq('student_id', studentId),
    supabase.from('course_enrollments').select('status, course:courses(id, name)').eq('student_id', studentId),
    supabase.from('course_class_students').select('status, class:course_classes(id, name, course:courses(id, name))').eq('student_id', studentId),
  ]);

  return {
    teachers: (assignmentsRes.data || [])
      .filter((a: any) => a.teacher && !isTestProfile(a.teacher))
      .map((a: any) => ({ id: a.teacher.id, name: a.teacher.full_name || 'Unknown', subject: a.subject?.name || null, status: a.status })),
    courses: (enrollmentsRes.data || [])
      .map((e: any) => ({ id: e.course?.id, name: e.course?.name, status: e.status }))
      .filter((c: any) => c.id),
    classMemberships: (classMembershipsRes.data || [])
      .map((m: any) => ({ id: m.class?.id, name: m.class?.name, course: m.class?.course?.name, status: m.status }))
      .filter((c: any) => c.id),
  };
}

async function fetchAsParent(parentId: string) {
  const { data: links } = await supabase
    .from('student_parent_links')
    .select('student:profiles!student_parent_links_student_id_fkey(id, full_name, email)')
    .eq('parent_id', parentId);

  const children = (links || []).map((c: any) => c.student).filter((s: any) => s && !isTestProfile(s));

  const childData = await Promise.all(
    children.map(async (child: any) => {
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('status, teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name, email), subject:subjects(name)')
        .eq('student_id', child.id);
      return {
        id: child.id,
        name: child.full_name,
        teachers: (assignments || [])
          .filter((a: any) => a.teacher && !isTestProfile(a.teacher))
          .map((a: any) => ({ id: a.teacher.id, name: a.teacher.full_name || 'Unknown', subject: a.subject?.name || null, status: a.status })),
      };
    }),
  );

  return { children: childData };
}

async function fetchSiblings(studentId: string) {
  const { data: parentLinks } = await supabase.from('student_parent_links').select('parent_id').eq('student_id', studentId);
  const parentIds = (parentLinks || []).map((p: any) => p.parent_id).filter(Boolean);
  if (!parentIds.length) return [];
  const { data: sibLinks } = await supabase
    .from('student_parent_links')
    .select('student:profiles!student_parent_links_student_id_fkey(id, full_name, email)')
    .in('parent_id', parentIds)
    .neq('student_id', studentId);
  const seen = new Set<string>();
  return (sibLinks || [])
    .map((s: any) => s.student)
    .filter((s: any) => s && !isTestProfile(s) && !seen.has(s.id) && seen.add(s.id));
}

async function fetchUnifiedConnections(userId: string, hintedRole?: ConnUserType) {
  const { data: rolesRes } = await supabase.from('user_roles').select('role').eq('user_id', userId);

  // FIX #4: Pull ALL roles, do not stop at first
  const allRoles: string[] = (rolesRes || []).map((r: any) => r.role);
  const roleSet = new Set<string>(allRoles);
  if (hintedRole && !roleSet.has(hintedRole)) {
    // hint is fallback only — never override real roles
  }
  if (roleSet.size === 0 && hintedRole) roleSet.add(hintedRole);

  const isTeacher = roleSet.has('teacher');
  const isStudent = roleSet.has('student');
  const isParent = roleSet.has('parent');

  const [profileRes, teacherData, studentData, parentData, siblings] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('id', userId).maybeSingle(),
    isTeacher ? fetchAsTeacher(userId) : Promise.resolve(null),
    isStudent ? fetchAsStudent(userId) : Promise.resolve(null),
    isParent ? fetchAsParent(userId) : Promise.resolve(null),
    isStudent ? fetchSiblings(userId) : Promise.resolve([] as any[]),
  ]);

  return {
    self: profileRes.data,
    allRoles: Array.from(roleSet), // every role from DB
    teacherData,
    studentData,
    parentData,
    siblings,
  };
}

/* ---------- Hub-and-spoke layout ---------- */
const NODE_W = 200;
const NODE_H = 90;
const COL_GAP = 60;
const ROW_GAP = 30;

interface Spoke {
  node: Node;
  edgeColor: string;
  edgeId: string;
  navUserType?: ConnUserType;
  navUserId?: string;
}

function buildHubAndSpoke(
  data: Awaited<ReturnType<typeof fetchUnifiedConnections>>,
  filter: RoleFilter,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const selfId = data.self?.id || 'self';

  // Buckets: column position relative to center
  // Left: parents (-2), Children (parent's kids) (-1), Center (0), Students (+1), Co-teachers (+2)
  // Above: classes/courses & teachers
  // Below: courses/classes (student) & siblings
  const above: Spoke[] = [];   // teachers (above center)
  const below: Spoke[] = [];   // courses (below center)
  const left: Spoke[] = [];    // parents/children
  const right: Spoke[] = [];   // students

  const showTeacher = (filter === 'all' || filter === 'teacher') && data.teacherData;
  const showStudent = (filter === 'all' || filter === 'student') && data.studentData;
  const showParent  = (filter === 'all' || filter === 'parent')  && data.parentData;

  if (showTeacher) {
    const td = data.teacherData!;
    td.students.forEach((s, i) => {
      const id = `t-st-${s.id}`;
      right.push({
        node: { id, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'student', title: s.name, subtitle: s.subject || undefined, badge: i === 0 ? 'Student' : undefined, status: s.status, navUserId: s.id, navUserType: 'student' } as PersonNodeData },
        edgeColor: EDGE_COLORS.student, edgeId: `e-${id}`, navUserId: s.id, navUserType: 'student',
      });
    });
    td.classes.forEach((c) => {
      const id = `t-cl-${c.id}`;
      below.push({
        node: { id, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'class', title: c.name || 'Class', subtitle: c.course || undefined, badge: 'Teaching', status: c.status } as PersonNodeData },
        edgeColor: EDGE_COLORS.course, edgeId: `e-${id}`,
      });
    });
    td.coteachers.forEach((t) => {
      const id = `t-co-${t.id}`;
      above.push({
        node: { id, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'coteacher', title: t.full_name, badge: 'Co-teacher', navUserId: t.id, navUserType: 'teacher' } as PersonNodeData },
        edgeColor: EDGE_COLORS.teacher, edgeId: `e-${id}`, navUserId: t.id, navUserType: 'teacher',
      });
    });
  }

  if (showStudent) {
    const sd = data.studentData!;
    sd.teachers.forEach((t) => {
      const id = `s-t-${t.id}`;
      above.push({
        node: { id, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'teacher', title: t.name, subtitle: t.subject || undefined, badge: 'My Teacher', status: t.status, navUserId: t.id, navUserType: 'teacher' } as PersonNodeData },
        edgeColor: EDGE_COLORS.teacher, edgeId: `e-${id}`, navUserId: t.id, navUserType: 'teacher',
      });
    });
    sd.courses.forEach((c) => {
      const id = `s-c-${c.id}`;
      below.push({
        node: { id, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'course', title: c.name, badge: 'Course', status: c.status } as PersonNodeData },
        edgeColor: EDGE_COLORS.course, edgeId: `e-${id}`,
      });
    });
    sd.classMemberships.forEach((m) => {
      const id = `s-cm-${m.id}`;
      below.push({
        node: { id, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'class', title: m.name || 'Class', subtitle: m.course || undefined, badge: 'Group Class', status: m.status } as PersonNodeData },
        edgeColor: EDGE_COLORS.course, edgeId: `e-${id}`,
      });
    });
    (data.siblings || []).forEach((s: any) => {
      const id = `s-sib-${s.id}`;
      left.push({
        node: { id, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'sibling', title: s.full_name, badge: 'Sibling', navUserId: s.id, navUserType: 'student' } as PersonNodeData },
        edgeColor: EDGE_COLORS.sibling, edgeId: `e-${id}`, navUserId: s.id, navUserType: 'student',
      });
    });
  }

  if (showParent) {
    const pd = data.parentData!;
    pd.children.forEach((c) => {
      const id = `p-ch-${c.id}`;
      left.push({
        node: { id, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'student', title: c.name, badge: 'My Child', navUserId: c.id, navUserType: 'student' } as PersonNodeData },
        edgeColor: EDGE_COLORS.parent, edgeId: `e-${id}`, navUserId: c.id, navUserType: 'student',
      });
      // child's teachers branch further left (above)
      c.teachers.forEach((t) => {
        const tId = `p-t-${c.id}-${t.id}`;
        above.push({
          node: { id: tId, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'teacher', title: t.name, subtitle: t.subject || undefined, badge: `Teacher of ${c.name.split(' ')[0]}`, status: t.status, navUserId: t.id, navUserType: 'teacher' } as PersonNodeData },
          edgeColor: EDGE_COLORS.teacher, edgeId: `e-${tId}`, navUserId: t.id, navUserType: 'teacher',
        });
      });
    });
  }

  // Center node
  nodes.push({
    id: selfId,
    type: 'person',
    position: { x: 0, y: 0 },
    data: {
      kind: 'self',
      title: data.self?.full_name || 'User',
      subtitle: data.allRoles.map((r) => ROLE_LABEL[r] || r).join(' · ') || 'User',
      roles: data.allRoles,
    } as PersonNodeData,
  });

  // Position spokes radially around center
  const placeColumn = (spokes: Spoke[], baseX: number, baseY: number, vertical: boolean) => {
    const total = spokes.length;
    if (!total) return;
    if (vertical) {
      const startY = baseY - ((total - 1) * (NODE_H + ROW_GAP)) / 2;
      spokes.forEach((s, i) => {
        s.node.position = { x: baseX, y: startY + i * (NODE_H + ROW_GAP) };
        nodes.push(s.node);
      });
    } else {
      // horizontal row
      const startX = baseX - ((total - 1) * (NODE_W + COL_GAP)) / 2;
      spokes.forEach((s, i) => {
        s.node.position = { x: startX + i * (NODE_W + COL_GAP), y: baseY };
        nodes.push(s.node);
      });
    }
  };

  // Center at 0,0; place sections around
  placeColumn(left,  -(NODE_W + COL_GAP * 2), 0, true);
  placeColumn(right,  (NODE_W + COL_GAP * 2), 0, true);
  placeColumn(above,  0, -(NODE_H + 140), false);
  placeColumn(below,  0,  (NODE_H + 140), false);

  // Build edges with proper handles + colors + animation
  const edgeFor = (target: Spoke, side: 'top' | 'bottom' | 'left' | 'right'): Edge => {
    const sourceHandle = side; // self handle position
    const targetHandle = side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left';
    return {
      id: target.edgeId,
      source: selfId,
      target: target.node.id,
      sourceHandle: undefined, // multiple unmapped handles render fine without explicit IDs in RF v11
      targetHandle: undefined,
      type: 'smoothstep',
      animated: true,
      style: { stroke: target.edgeColor, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: target.edgeColor, width: 18, height: 18 },
    };
  };

  left.forEach((s) => edges.push(edgeFor(s, 'left')));
  right.forEach((s) => edges.push(edgeFor(s, 'right')));
  above.forEach((s) => edges.push(edgeFor(s, 'top')));
  below.forEach((s) => edges.push(edgeFor(s, 'bottom')));

  // Center self position (offset so it sits at 0,0 visually centered)
  const selfNode = nodes.find((n) => n.id === selfId);
  if (selfNode) selfNode.position = { x: -120, y: -45 };

  return { nodes, edges, sectionLabels: { left: left.length, right: right.length, above: above.length, below: below.length } };
}

/* ---------- Main component ---------- */
export function UserConnectionsGraph({ userId, userType, roleFilter = 'all', compact = false, className }: Props) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['user-connections-unified', userId, userType],
    queryFn: () => fetchUnifiedConnections(userId, userType),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { nodes, edges, sectionLabels } = useMemo(() => {
    if (!data) return { nodes: [], edges: [], sectionLabels: { left: 0, right: 0, above: 0, below: 0 } };
    return buildHubAndSpoke(data, roleFilter);
  }, [data, roleFilter]);

  // FIX #6: Click navigation
  const onNodeClick = useCallback((_: any, node: Node) => {
    const d = node.data as PersonNodeData;
    if (d.navUserId && d.navUserType) {
      navigate(`/connections/${d.navUserType}/${d.navUserId}`);
    }
  }, [navigate]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', compact ? 'h-[320px]' : 'h-[600px]', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!nodes.length) {
    return (
      <div className={cn('flex items-center justify-center text-sm text-muted-foreground', compact ? 'h-[320px]' : 'h-[600px]', className)}>
        No connections found.
      </div>
    );
  }

  return (
    <div className={cn('w-full rounded-lg border bg-card relative', compact ? 'h-[400px]' : 'h-[680px]', className)}>
      {/* Section headers overlay */}
      {!compact && (
        <div className="absolute inset-x-0 top-2 z-10 pointer-events-none flex justify-center gap-6 text-[10px] font-bold uppercase tracking-wider">
          {sectionLabels.above > 0 && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">↑ Teachers ({sectionLabels.above})</span>}
          {sectionLabels.left > 0 &&  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">← Family ({sectionLabels.left})</span>}
          {sectionLabels.right > 0 && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Students → ({sectionLabels.right})</span>}
          {sectionLabels.below > 0 && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300">↓ Courses ({sectionLabels.below})</span>}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!compact}
        nodesConnectable={false}
        elementsSelectable
        zoomOnScroll
        panOnDrag
        defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
      >
        <Background gap={20} size={1} className="opacity-40" />
        <Controls showInteractive={false} className="!shadow-md" />
      </ReactFlow>
    </div>
  );
}
