import React, { useEffect, useMemo } from 'react';
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
import { Loader2, User, GraduationCap, Users, BookOpen, Heart, Baby } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConnUserType = 'student' | 'teacher' | 'parent';

interface Props {
  userId: string;
  userType: ConnUserType;
  /** When true, render with a fixed compact height suited for drawer/cards */
  compact?: boolean;
  className?: string;
}

/* ---------- Custom node ---------- */
type NodeKind = 'self' | 'teacher' | 'student' | 'parent' | 'sibling' | 'course' | 'class' | 'coteacher';

const NODE_STYLES: Record<NodeKind, { bg: string; border: string; text: string; icon: React.ComponentType<any>; label: string }> = {
  self:       { bg: 'bg-primary',          border: 'border-primary',         text: 'text-primary-foreground', icon: User,          label: 'You' },
  teacher:    { bg: 'bg-blue-500/10',      border: 'border-blue-500/40',     text: 'text-blue-700 dark:text-blue-300',     icon: GraduationCap, label: 'Teacher' },
  student:    { bg: 'bg-emerald-500/10',   border: 'border-emerald-500/40',  text: 'text-emerald-700 dark:text-emerald-300', icon: Users,       label: 'Student' },
  parent:     { bg: 'bg-rose-500/10',      border: 'border-rose-500/40',     text: 'text-rose-700 dark:text-rose-300',     icon: Heart,         label: 'Parent' },
  sibling:    { bg: 'bg-violet-500/10',    border: 'border-violet-500/40',   text: 'text-violet-700 dark:text-violet-300', icon: Baby,          label: 'Sibling' },
  course:     { bg: 'bg-amber-500/10',     border: 'border-amber-500/40',    text: 'text-amber-700 dark:text-amber-300',   icon: BookOpen,      label: 'Course' },
  class:      { bg: 'bg-amber-500/10',     border: 'border-amber-500/40',    text: 'text-amber-700 dark:text-amber-300',   icon: BookOpen,      label: 'Class' },
  coteacher:  { bg: 'bg-indigo-500/10',    border: 'border-indigo-500/40',   text: 'text-indigo-700 dark:text-indigo-300', icon: GraduationCap, label: 'Co-teacher' },
};

interface PersonNodeData {
  kind: NodeKind;
  title: string;
  subtitle?: string;
  badge?: string;
}

function PersonNode({ data }: NodeProps<PersonNodeData>) {
  const style = NODE_STYLES[data.kind];
  const Icon = style.icon;
  const isSelf = data.kind === 'self';
  return (
    <div
      className={cn(
        'rounded-xl border-2 px-3 py-2 shadow-sm min-w-[160px] max-w-[200px]',
        style.bg,
        style.border,
        isSelf && 'shadow-lg ring-2 ring-primary/30',
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40 !w-2 !h-2" />
      <div className="flex items-start gap-2">
        <div className={cn('rounded-md p-1.5 shrink-0', isSelf ? 'bg-white/20' : 'bg-background/80')}>
          <Icon className={cn('h-3.5 w-3.5', style.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-semibold leading-tight truncate', style.text)}>{data.title}</p>
          {data.subtitle && (
            <p className={cn('text-[10px] mt-0.5 leading-tight truncate opacity-80', style.text)}>{data.subtitle}</p>
          )}
          {data.badge && (
            <span className={cn('inline-block mt-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-background/70', style.text)}>
              {data.badge}
            </span>
          )}
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
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 30, marginx: 20, marginy: 20 });

  nodes.forEach((n) => g.setNode(n.id, { width: 200, height: 70 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const positioned = nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 100, y: pos.y - 35 } };
  });
  return { nodes: positioned, edges };
}

/* ---------- Data fetchers ---------- */
async function fetchStudentConnections(studentId: string) {
  const [profileRes, assignmentsRes, parentsRes, enrollmentsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('id', studentId).maybeSingle(),
    supabase
      .from('student_teacher_assignments')
      .select('id, status, teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name), subject:subjects(name)')
      .eq('student_id', studentId)
      .eq('status', 'active'),
    supabase
      .from('student_parent_links')
      .select('parent:profiles!student_parent_links_parent_id_fkey(id, full_name)')
      .eq('student_id', studentId),
    supabase
      .from('course_enrollments')
      .select('status, course:courses(id, name)')
      .eq('student_id', studentId)
      .eq('status', 'active'),
  ]);

  // Siblings = other students sharing any of this student's parents
  const parentIds = (parentsRes.data || []).map((p: any) => p.parent?.id).filter(Boolean);
  let siblings: Array<{ id: string; full_name: string }> = [];
  if (parentIds.length) {
    const { data: sibLinks } = await supabase
      .from('student_parent_links')
      .select('student:profiles!student_parent_links_student_id_fkey(id, full_name)')
      .in('parent_id', parentIds)
      .neq('student_id', studentId);
    const seen = new Set<string>();
    siblings = (sibLinks || [])
      .map((s: any) => s.student)
      .filter((s: any) => s && !seen.has(s.id) && seen.add(s.id));
  }

  return {
    self: profileRes.data,
    teachers: (assignmentsRes.data || []).map((a: any) => ({
      id: a.teacher?.id,
      name: a.teacher?.full_name || 'Unknown',
      subject: a.subject?.name || null,
    })).filter((t: any) => t.id),
    parents: (parentsRes.data || []).map((p: any) => p.parent).filter(Boolean),
    courses: (enrollmentsRes.data || []).map((e: any) => e.course).filter(Boolean),
    siblings,
  };
}

async function fetchTeacherConnections(teacherId: string) {
  const [profileRes, assignmentsRes, classesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('id', teacherId).maybeSingle(),
    supabase
      .from('student_teacher_assignments')
      .select('id, status, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name), subject:subjects(name)')
      .eq('teacher_id', teacherId)
      .eq('status', 'active'),
    supabase
      .from('course_class_staff')
      .select('class:course_classes(id, name, course:courses(name))')
      .eq('user_id', teacherId),
  ]);

  // Co-teachers = other teachers in any of the same classes
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
    self: profileRes.data,
    students: (assignmentsRes.data || []).map((a: any) => ({
      id: a.student?.id,
      name: a.student?.full_name || 'Unknown',
      subject: a.subject?.name || null,
    })).filter((s: any) => s.id),
    classes: (classesRes.data || []).map((c: any) => ({
      id: c.class?.id,
      name: c.class?.name,
      course: c.class?.course?.name,
    })).filter((c: any) => c.id),
    coteachers,
  };
}

async function fetchParentConnections(parentId: string) {
  const [profileRes, childrenRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('id', parentId).maybeSingle(),
    supabase
      .from('student_parent_links')
      .select('student:profiles!student_parent_links_student_id_fkey(id, full_name)')
      .eq('parent_id', parentId),
  ]);

  const children = (childrenRes.data || []).map((c: any) => c.student).filter(Boolean);

  // For each child, fetch their active teachers + subject
  const childData = await Promise.all(
    children.map(async (child: any) => {
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name), subject:subjects(name)')
        .eq('student_id', child.id)
        .eq('status', 'active');
      return {
        id: child.id,
        name: child.full_name,
        teachers: (assignments || []).map((a: any) => ({
          id: a.teacher?.id,
          name: a.teacher?.full_name || 'Unknown',
          subject: a.subject?.name || null,
        })).filter((t: any) => t.id),
      };
    }),
  );

  return { self: profileRes.data, children: childData };
}

/* ---------- Graph builders ---------- */
function buildStudentGraph(data: Awaited<ReturnType<typeof fetchStudentConnections>>) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const selfId = data.self?.id || 'self';

  nodes.push({
    id: selfId,
    type: 'person',
    position: { x: 0, y: 0 },
    data: { kind: 'self', title: data.self?.full_name || 'Student', subtitle: 'Student' } as PersonNodeData,
  });

  data.parents.forEach((p: any) => {
    nodes.push({ id: `p-${p.id}`, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'parent', title: p.full_name, badge: 'Parent' } });
    edges.push({ id: `e-p-${p.id}`, source: `p-${p.id}`, target: selfId, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
  });

  data.teachers.forEach((t) => {
    nodes.push({ id: `t-${t.id}`, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'teacher', title: t.name, subtitle: t.subject || undefined, badge: 'Teacher' } });
    edges.push({ id: `e-t-${t.id}`, source: selfId, target: `t-${t.id}`, type: 'smoothstep', label: t.subject || undefined, markerEnd: { type: MarkerType.ArrowClosed } });
  });

  data.courses.forEach((c: any) => {
    nodes.push({ id: `c-${c.id}`, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'course', title: c.name, badge: 'Course' } });
    edges.push({ id: `e-c-${c.id}`, source: selfId, target: `c-${c.id}`, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
  });

  data.siblings.forEach((s) => {
    nodes.push({ id: `s-${s.id}`, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'sibling', title: s.full_name, badge: 'Sibling' } });
    edges.push({ id: `e-s-${s.id}`, source: selfId, target: `s-${s.id}`, type: 'smoothstep', style: { strokeDasharray: '4 4' } });
  });

  return layoutGraph(nodes, edges);
}

function buildTeacherGraph(data: Awaited<ReturnType<typeof fetchTeacherConnections>>) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const selfId = data.self?.id || 'self';

  nodes.push({
    id: selfId,
    type: 'person',
    position: { x: 0, y: 0 },
    data: { kind: 'self', title: data.self?.full_name || 'Teacher', subtitle: 'Teacher' },
  });

  data.classes.forEach((c) => {
    nodes.push({ id: `cl-${c.id}`, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'class', title: c.name || 'Class', subtitle: c.course || undefined, badge: 'Class' } });
    edges.push({ id: `e-cl-${c.id}`, source: selfId, target: `cl-${c.id}`, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
  });

  data.coteachers.forEach((t) => {
    nodes.push({ id: `co-${t.id}`, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'coteacher', title: t.full_name, badge: 'Co-teacher' } });
    edges.push({ id: `e-co-${t.id}`, source: selfId, target: `co-${t.id}`, type: 'smoothstep', style: { strokeDasharray: '4 4' } });
  });

  data.students.forEach((s) => {
    nodes.push({ id: `st-${s.id}`, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'student', title: s.name, subtitle: s.subject || undefined, badge: 'Student' } });
    edges.push({ id: `e-st-${s.id}`, source: selfId, target: `st-${s.id}`, type: 'smoothstep', label: s.subject || undefined, markerEnd: { type: MarkerType.ArrowClosed } });
  });

  return layoutGraph(nodes, edges);
}

function buildParentGraph(data: Awaited<ReturnType<typeof fetchParentConnections>>) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const selfId = data.self?.id || 'self';

  nodes.push({
    id: selfId,
    type: 'person',
    position: { x: 0, y: 0 },
    data: { kind: 'self', title: data.self?.full_name || 'Parent', subtitle: 'Parent' },
  });

  data.children.forEach((c) => {
    nodes.push({ id: `ch-${c.id}`, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'student', title: c.name, badge: 'Child' } });
    edges.push({ id: `e-ch-${c.id}`, source: selfId, target: `ch-${c.id}`, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });

    c.teachers.forEach((t) => {
      const tId = `t-${c.id}-${t.id}`;
      nodes.push({ id: tId, type: 'person', position: { x: 0, y: 0 }, data: { kind: 'teacher', title: t.name, subtitle: t.subject || undefined, badge: 'Teacher' } });
      edges.push({ id: `e-${tId}`, source: `ch-${c.id}`, target: tId, type: 'smoothstep', label: t.subject || undefined, markerEnd: { type: MarkerType.ArrowClosed } });
    });
  });

  return layoutGraph(nodes, edges);
}

/* ---------- Main component ---------- */
export function UserConnectionsGraph({ userId, userType, compact = false, className }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-connections', userType, userId],
    queryFn: async () => {
      if (userType === 'student') return await fetchStudentConnections(userId);
      if (userType === 'teacher') return await fetchTeacherConnections(userId);
      return await fetchParentConnections(userId);
    },
    enabled: !!userId,
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    if (userType === 'student') return buildStudentGraph(data as any);
    if (userType === 'teacher') return buildTeacherGraph(data as any);
    return buildParentGraph(data as any);
  }, [data, userType]);

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
