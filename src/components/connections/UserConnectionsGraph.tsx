import React, { useMemo } from 'react';
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
import dagre from 'dagre';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, User, GraduationCap, Users, BookOpen, Heart, Baby, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConnUserType = 'student' | 'teacher' | 'parent';
export type RoleFilter = 'all' | 'teacher' | 'student' | 'parent';

interface Props {
  userId: string;
  /** Optional — when omitted, all detected roles are aggregated. */
  userType?: ConnUserType;
  /** Filter the unified graph to a single role lane. Defaults to 'all'. */
  roleFilter?: RoleFilter;
  /** Compact height for drawers/cards. */
  compact?: boolean;
  className?: string;
}

/* ---------- Node styling ---------- */
type NodeKind =
  | 'self'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'sibling'
  | 'course'
  | 'class'
  | 'coteacher'
  | 'lane';

const NODE_STYLES: Record<NodeKind, { bg: string; border: string; text: string; icon: React.ComponentType<any> }> = {
  self:      { bg: 'bg-primary',          border: 'border-primary',         text: 'text-primary-foreground',                icon: User },
  teacher:   { bg: 'bg-blue-500/10',      border: 'border-blue-500/40',     text: 'text-blue-700 dark:text-blue-300',       icon: GraduationCap },
  student:   { bg: 'bg-emerald-500/10',   border: 'border-emerald-500/40',  text: 'text-emerald-700 dark:text-emerald-300', icon: Users },
  parent:    { bg: 'bg-rose-500/10',      border: 'border-rose-500/40',     text: 'text-rose-700 dark:text-rose-300',       icon: Heart },
  sibling:   { bg: 'bg-violet-500/10',    border: 'border-violet-500/40',   text: 'text-violet-700 dark:text-violet-300',   icon: Baby },
  course:    { bg: 'bg-amber-500/10',     border: 'border-amber-500/40',    text: 'text-amber-700 dark:text-amber-300',     icon: BookOpen },
  class:     { bg: 'bg-amber-500/10',     border: 'border-amber-500/40',    text: 'text-amber-700 dark:text-amber-300',     icon: BookOpen },
  coteacher: { bg: 'bg-indigo-500/10',    border: 'border-indigo-500/40',   text: 'text-indigo-700 dark:text-indigo-300',   icon: GraduationCap },
  lane:      { bg: 'bg-muted/40',         border: 'border-dashed border-muted-foreground/40', text: 'text-muted-foreground', icon: Layers },
};

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  completed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  paused:    'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ended:     'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
  withdrawn: 'bg-muted text-muted-foreground',
};

interface PersonNodeData {
  kind: NodeKind;
  title: string;
  subtitle?: string;
  badge?: string;
  status?: string;
  roles?: string[]; // for self node
}

function PersonNode({ data }: NodeProps<PersonNodeData>) {
  const style = NODE_STYLES[data.kind];
  const Icon = style.icon;
  const isSelf = data.kind === 'self';
  const isLane = data.kind === 'lane';

  if (isLane) {
    return (
      <div className={cn('rounded-lg border-2 px-3 py-1.5', style.bg, style.border)}>
        <p className={cn('text-[11px] font-bold uppercase tracking-wider', style.text)}>{data.title}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border-2 shadow-sm',
        isSelf ? 'px-4 py-3 min-w-[200px] max-w-[260px] shadow-lg ring-2 ring-primary/30 bg-gradient-to-br from-primary to-[hsl(var(--navy-light,221_70%_42%))]' : 'px-3 py-2 min-w-[160px] max-w-[220px]',
        !isSelf && style.bg,
        !isSelf && style.border,
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40 !w-2 !h-2" />
      <div className="flex items-start gap-2">
        <div className={cn('rounded-md p-1.5 shrink-0', isSelf ? 'bg-white/20' : 'bg-background/80')}>
          <Icon className={cn(isSelf ? 'h-4 w-4' : 'h-3.5 w-3.5', style.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold leading-tight truncate', isSelf ? 'text-sm' : 'text-xs', style.text)}>{data.title}</p>
          {data.subtitle && (
            <p className={cn('text-[10px] mt-0.5 leading-tight truncate opacity-80', style.text)}>{data.subtitle}</p>
          )}
          {isSelf && data.roles && data.roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {data.roles.map((r) => (
                <span key={r} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 text-primary-foreground capitalize">
                  {r}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {data.badge && (
              <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded', isSelf ? 'bg-white/20 text-primary-foreground' : 'bg-background/70', !isSelf && style.text)}>
                {data.badge}
              </span>
            )}
            {data.status && (
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded capitalize', STATUS_BADGE[data.status] || 'bg-muted text-muted-foreground')}>
                {data.status}
              </span>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { person: PersonNode };

/* ---------- Layout ---------- */
function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 70, nodesep: 35, marginx: 20, marginy: 20 });

  nodes.forEach((n) => {
    const isSelf = (n.data as PersonNodeData)?.kind === 'self';
    const isLane = (n.data as PersonNodeData)?.kind === 'lane';
    g.setNode(n.id, { width: isSelf ? 240 : isLane ? 180 : 200, height: isSelf ? 100 : isLane ? 36 : 80 });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const positioned = nodes.map((n) => {
    const pos = g.node(n.id);
    const isSelf = (n.data as PersonNodeData)?.kind === 'self';
    const w = isSelf ? 240 : 200;
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - 40 } };
  });
  return { nodes: positioned, edges };
}

/* ---------- Data fetchers (no status filtering — return all history) ---------- */
async function fetchAsTeacher(teacherId: string) {
  const [assignmentsRes, classesRes] = await Promise.all([
    supabase
      .from('student_teacher_assignments')
      .select('id, status, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name), subject:subjects(name)')
      .eq('teacher_id', teacherId),
    supabase
      .from('course_class_staff')
      .select('class:course_classes(id, name, status, course:courses(name))')
      .eq('user_id', teacherId),
  ]);

  const classIds = (classesRes.data || []).map((c: any) => c.class?.id).filter(Boolean);
  let coteachers: Array<{ id: string; full_name: string }> = [];
  if (classIds.length) {
    const { data: peers } = await supabase
      .from('course_class_staff')
      .select('user:profiles!course_class_staff_user_id_fkey(id, full_name)')
      .in('class_id', classIds)
      .neq('user_id', teacherId);
    const seen = new Set<string>();
    coteachers = (peers || [])
      .map((p: any) => p.user)
      .filter((u: any) => u && !seen.has(u.id) && seen.add(u.id));
  }

  return {
    students: (assignmentsRes.data || [])
      .map((a: any) => ({ id: a.student?.id, name: a.student?.full_name || 'Unknown', subject: a.subject?.name || null, status: a.status }))
      .filter((s: any) => s.id),
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
      .select('id, status, teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name), subject:subjects(name)')
      .eq('student_id', studentId),
    supabase
      .from('course_enrollments')
      .select('status, enrolled_at, course:courses(id, name)')
      .eq('student_id', studentId),
    supabase
      .from('course_class_students')
      .select('status, class:course_classes(id, name, course:courses(id, name))')
      .eq('student_id', studentId),
  ]);

  return {
    teachers: (assignmentsRes.data || [])
      .map((a: any) => ({ id: a.teacher?.id, name: a.teacher?.full_name || 'Unknown', subject: a.subject?.name || null, status: a.status }))
      .filter((t: any) => t.id),
    courses: (enrollmentsRes.data || [])
      .map((e: any) => ({ id: e.course?.id, name: e.course?.name, status: e.status }))
      .filter((c: any) => c.id),
    classMemberships: (classMembershipsRes.data || [])
      .map((m: any) => ({
        id: m.class?.id,
        name: m.class?.name,
        course: m.class?.course?.name,
        status: m.status,
      }))
      .filter((c: any) => c.id),
  };
}

async function fetchAsParent(parentId: string) {
  const { data: links } = await supabase
    .from('student_parent_links')
    .select('student:profiles!student_parent_links_student_id_fkey(id, full_name)')
    .eq('parent_id', parentId);

  const children = (links || []).map((c: any) => c.student).filter(Boolean);

  const childData = await Promise.all(
    children.map(async (child: any) => {
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('status, teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name), subject:subjects(name)')
        .eq('student_id', child.id);
      return {
        id: child.id,
        name: child.full_name,
        teachers: (assignments || [])
          .map((a: any) => ({ id: a.teacher?.id, name: a.teacher?.full_name || 'Unknown', subject: a.subject?.name || null, status: a.status }))
          .filter((t: any) => t.id),
      };
    }),
  );

  return { children: childData };
}

async function fetchSiblings(studentId: string) {
  const { data: parentLinks } = await supabase
    .from('student_parent_links')
    .select('parent_id')
    .eq('student_id', studentId);
  const parentIds = (parentLinks || []).map((p: any) => p.parent_id).filter(Boolean);
  if (!parentIds.length) return [];
  const { data: sibLinks } = await supabase
    .from('student_parent_links')
    .select('student:profiles!student_parent_links_student_id_fkey(id, full_name)')
    .in('parent_id', parentIds)
    .neq('student_id', studentId);
  const seen = new Set<string>();
  return (sibLinks || [])
    .map((s: any) => s.student)
    .filter((s: any) => s && !seen.has(s.id) && seen.add(s.id));
}

async function fetchUnifiedConnections(userId: string, hintedRole?: ConnUserType) {
  // Detect all roles
  const { data: rolesRes } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const roleSet = new Set<string>((rolesRes || []).map((r: any) => r.role));
  if (hintedRole) roleSet.add(hintedRole);
  // Heuristic: if no roles found at all, fall back to hinted or treat as student
  if (roleSet.size === 0) roleSet.add(hintedRole || 'student');

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

  const activeRoles: string[] = [];
  if (isTeacher) activeRoles.push('Teacher');
  if (isStudent) activeRoles.push('Student');
  if (isParent) activeRoles.push('Parent');

  return {
    self: profileRes.data,
    activeRoles,
    teacherData,
    studentData,
    parentData,
    siblings,
  };
}

/* ---------- Graph builder ---------- */
function buildUnifiedGraph(
  data: Awaited<ReturnType<typeof fetchUnifiedConnections>>,
  filter: RoleFilter,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const selfId = data.self?.id || 'self';

  nodes.push({
    id: selfId,
    type: 'person',
    position: { x: 0, y: 0 },
    data: {
      kind: 'self',
      title: data.self?.full_name || 'User',
      subtitle: data.activeRoles.join(' · ') || 'User',
      roles: data.activeRoles,
    } as PersonNodeData,
  });

  const showTeacher = (filter === 'all' || filter === 'teacher') && data.teacherData;
  const showStudent = (filter === 'all' || filter === 'student') && data.studentData;
  const showParent = (filter === 'all' || filter === 'parent') && data.parentData;

  // ── As Teacher lane ──
  if (showTeacher) {
    const td = data.teacherData!;
    const laneId = 'lane-teacher';
    if (td.classes.length || td.students.length || td.coteachers.length) {
      nodes.push({ id: laneId, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'lane', title: 'As Teacher' } as PersonNodeData });
      edges.push({ id: `e-${selfId}-${laneId}`, source: selfId, target: laneId, type: 'smoothstep', style: { strokeDasharray: '2 4', opacity: 0.5 } });
    }
    td.classes.forEach((c) => {
      const id = `t-cl-${c.id}`;
      nodes.push({
        id, type: 'person', position: { x: 0, y: 0 },
        data: { kind: 'class', title: c.name || 'Class', subtitle: c.course || undefined, badge: 'Class', status: c.status } as PersonNodeData,
      });
      edges.push({ id: `e-${id}`, source: laneId, target: id, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
    });
    td.students.forEach((s) => {
      const id = `t-st-${s.id}`;
      nodes.push({
        id, type: 'person', position: { x: 0, y: 0 },
        data: { kind: 'student', title: s.name, subtitle: s.subject || undefined, badge: 'Student', status: s.status } as PersonNodeData,
      });
      edges.push({ id: `e-${id}`, source: laneId, target: id, type: 'smoothstep', label: s.subject || undefined, markerEnd: { type: MarkerType.ArrowClosed } });
    });
    td.coteachers.forEach((t) => {
      const id = `t-co-${t.id}`;
      nodes.push({
        id, type: 'person', position: { x: 0, y: 0 },
        data: { kind: 'coteacher', title: t.full_name, badge: 'Co-teacher' } as PersonNodeData,
      });
      edges.push({ id: `e-${id}`, source: laneId, target: id, type: 'smoothstep', style: { strokeDasharray: '4 4' } });
    });
  }

  // ── As Student lane ──
  if (showStudent) {
    const sd = data.studentData!;
    const laneId = 'lane-student';
    const hasAny = sd.teachers.length || sd.courses.length || sd.classMemberships.length || (data.siblings && data.siblings.length);
    if (hasAny) {
      nodes.push({ id: laneId, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'lane', title: 'As Student' } as PersonNodeData });
      edges.push({ id: `e-${selfId}-${laneId}`, source: selfId, target: laneId, type: 'smoothstep', style: { strokeDasharray: '2 4', opacity: 0.5 } });
    }
    sd.teachers.forEach((t) => {
      const id = `s-t-${t.id}`;
      nodes.push({
        id, type: 'person', position: { x: 0, y: 0 },
        data: { kind: 'teacher', title: t.name, subtitle: t.subject || undefined, badge: 'My Teacher', status: t.status } as PersonNodeData,
      });
      edges.push({ id: `e-${id}`, source: laneId, target: id, type: 'smoothstep', label: t.subject || undefined, markerEnd: { type: MarkerType.ArrowClosed } });
    });
    sd.courses.forEach((c) => {
      const id = `s-c-${c.id}`;
      nodes.push({
        id, type: 'person', position: { x: 0, y: 0 },
        data: { kind: 'course', title: c.name, badge: 'Course', status: c.status } as PersonNodeData,
      });
      edges.push({ id: `e-${id}`, source: laneId, target: id, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
    });
    sd.classMemberships.forEach((m) => {
      const id = `s-cm-${m.id}`;
      nodes.push({
        id, type: 'person', position: { x: 0, y: 0 },
        data: { kind: 'class', title: m.name || 'Class', subtitle: m.course || undefined, badge: 'Group Class', status: m.status } as PersonNodeData,
      });
      edges.push({ id: `e-${id}`, source: laneId, target: id, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
    });
    (data.siblings || []).forEach((s: any) => {
      const id = `s-sib-${s.id}`;
      nodes.push({
        id, type: 'person', position: { x: 0, y: 0 },
        data: { kind: 'sibling', title: s.full_name, badge: 'Sibling' } as PersonNodeData,
      });
      edges.push({ id: `e-${id}`, source: laneId, target: id, type: 'smoothstep', style: { strokeDasharray: '4 4' } });
    });
  }

  // ── As Parent lane ──
  if (showParent) {
    const pd = data.parentData!;
    const laneId = 'lane-parent';
    if (pd.children.length) {
      nodes.push({ id: laneId, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'lane', title: 'As Parent' } as PersonNodeData });
      edges.push({ id: `e-${selfId}-${laneId}`, source: selfId, target: laneId, type: 'smoothstep', style: { strokeDasharray: '2 4', opacity: 0.5 } });
    }
    pd.children.forEach((c) => {
      const id = `p-ch-${c.id}`;
      nodes.push({
        id, type: 'person', position: { x: 0, y: 0 },
        data: { kind: 'student', title: c.name, badge: 'Child' } as PersonNodeData,
      });
      edges.push({ id: `e-${id}`, source: laneId, target: id, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });

      c.teachers.forEach((t) => {
        const tId = `p-t-${c.id}-${t.id}`;
        nodes.push({
          id: tId, type: 'person', position: { x: 0, y: 0 },
          data: { kind: 'teacher', title: t.name, subtitle: t.subject || undefined, badge: 'Teacher', status: t.status } as PersonNodeData,
        });
        edges.push({ id: `e-${tId}`, source: id, target: tId, type: 'smoothstep', label: t.subject || undefined, markerEnd: { type: MarkerType.ArrowClosed } });
      });
    });
  }

  return layoutGraph(nodes, edges);
}

/* ---------- Main component ---------- */
export function UserConnectionsGraph({ userId, userType, roleFilter = 'all', compact = false, className }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-connections-unified', userId, userType],
    queryFn: () => fetchUnifiedConnections(userId, userType),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return buildUnifiedGraph(data, roleFilter);
  }, [data, roleFilter]);

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
    <div className={cn('w-full rounded-lg border bg-card', compact ? 'h-[360px]' : 'h-[640px]', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!compact}
        nodesConnectable={false}
        elementsSelectable
        zoomOnScroll
        panOnDrag
      >
        <Background gap={20} size={1} className="opacity-40" />
        <Controls showInteractive={false} className="!shadow-md" />
      </ReactFlow>
    </div>
  );
}
