import React, { useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  MarkerType,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, GraduationCap, Users, BookOpen, Heart, Baby, Download, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import dagre from 'dagre';
import { toPng } from 'html-to-image';

export type ConnUserType = 'student' | 'teacher' | 'parent';
export type RoleFilter = 'all' | 'teacher' | 'student' | 'parent';

interface Props {
  userId: string;
  userType?: ConnUserType;
  roleFilter?: RoleFilter;
  compact?: boolean;
  className?: string;
}

/* ---------- Role pill colors (center node) ---------- */
const ROLE_PILL: Record<string, { bg: string; label: string }> = {
  super_admin:      { bg: 'bg-red-500',     label: 'Super Admin' },
  admin:            { bg: 'bg-blue-500',    label: 'Admin' },
  admin_admissions: { bg: 'bg-blue-500',    label: 'Admissions' },
  admin_fees:       { bg: 'bg-blue-500',    label: 'Fees Admin' },
  admin_academic:   { bg: 'bg-blue-500',    label: 'Academic Admin' },
  teacher:          { bg: 'bg-emerald-500', label: 'Teacher' },
  student:          { bg: 'bg-violet-500',  label: 'Student' },
  parent:           { bg: 'bg-amber-500',   label: 'Parent' },
  examiner:         { bg: 'bg-fuchsia-500', label: 'Examiner' },
};

const ROLE_PRIORITY = ['super_admin', 'admin', 'admin_academic', 'admin_admissions', 'admin_fees', 'teacher', 'examiner', 'student', 'parent'];

/* ---------- Relationship type → card colors ---------- */
type RelKind = 'self' | 'teacher' | 'student' | 'parent' | 'sibling' | 'course';

const REL_STYLE: Record<Exclude<RelKind, 'self'>, {
  bgClass: string; borderClass: string; headerClass: string; header: string; icon: React.ComponentType<any>;
}> = {
  teacher: { bgClass: 'bg-blue-50 dark:bg-blue-950/30',     borderClass: 'border-l-blue-500',   headerClass: 'text-blue-600 dark:text-blue-400',     header: 'Teaching Me',     icon: GraduationCap },
  student: { bgClass: 'bg-green-50 dark:bg-green-950/30',   borderClass: 'border-l-green-500',  headerClass: 'text-green-600 dark:text-green-400',   header: 'My Student',      icon: Users },
  parent:  { bgClass: 'bg-amber-50 dark:bg-amber-950/30',   borderClass: 'border-l-amber-500',  headerClass: 'text-amber-600 dark:text-amber-400',   header: 'Guardian',        icon: Heart },
  sibling: { bgClass: 'bg-purple-50 dark:bg-purple-950/30', borderClass: 'border-l-purple-500', headerClass: 'text-purple-600 dark:text-purple-400', header: 'Sibling',         icon: Baby },
  course:  { bgClass: 'bg-orange-50 dark:bg-orange-950/30', borderClass: 'border-l-orange-500', headerClass: 'text-orange-600 dark:text-orange-400', header: 'Enrolled Course', icon: BookOpen },
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  completed: 'bg-blue-500',
  paused: 'bg-gray-400',
  ended: 'bg-red-400',
  cancelled: 'bg-red-400',
  withdrawn: 'bg-red-400',
};

/* ---------- Edge colors per relationship ---------- */
const EDGE_STYLE: Record<Exclude<RelKind, 'self'>, { color: string; dashed: boolean }> = {
  teacher: { color: '#3b82f6', dashed: true  }, // blue dashed
  student: { color: '#22c55e', dashed: false }, // green solid
  parent:  { color: '#f59e0b', dashed: false }, // amber solid
  sibling: { color: '#a855f7', dashed: false }, // purple solid
  course:  { color: '#f97316', dashed: true  }, // orange dashed
};

interface NodeData {
  kind: RelKind;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  roles?: string[];
  primaryRoleLabel?: string;
  navUserId?: string;
  navUserType?: ConnUserType;
}

/* ---------- Center node ---------- */
function CenterNode({ data }: NodeProps<NodeData>) {
  const initials = (data.title || 'U').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const sortedRoles = (data.roles || []).slice().sort((a, b) => {
    const ai = ROLE_PRIORITY.indexOf(a); const bi = ROLE_PRIORITY.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return (
    <div className="rounded-2xl shadow-2xl ring-2 ring-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4 min-w-[280px] max-w-[340px]">
      <Handle type="target" position={Position.Top}    className="!opacity-0" />
      <Handle type="target" position={Position.Bottom} className="!opacity-0" />
      <Handle type="target" position={Position.Left}   className="!opacity-0" />
      <Handle type="target" position={Position.Right}  className="!opacity-0" />
      <Handle type="source" position={Position.Top}    className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle type="source" position={Position.Left}   className="!opacity-0" />
      <Handle type="source" position={Position.Right}  className="!opacity-0" />
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 ring-2 ring-white/20 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-base">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white text-base leading-tight truncate">{data.title}</p>
          {data.primaryRoleLabel && <p className="text-[11px] text-slate-300 mt-0.5 truncate">{data.primaryRoleLabel}</p>}
        </div>
      </div>
      {sortedRoles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/10">
          {sortedRoles.map((r) => {
            const meta = ROLE_PILL[r];
            if (!meta) return null;
            return (
              <span key={r} className={cn('text-[10px] font-bold text-white px-2 py-0.5 rounded-full shadow-sm', meta.bg)}>
                {meta.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Connected card ---------- */
function ConnectedNode({ data }: NodeProps<NodeData>) {
  if (data.kind === 'self') return null;
  const style = REL_STYLE[data.kind];
  const Icon = style.icon;
  const dot = data.status ? STATUS_DOT[data.status] || 'bg-gray-300' : null;
  return (
    <div
      className={cn(
        'rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer',
        'border border-border/40 border-l-4 px-3 py-2.5 min-w-[200px] max-w-[240px]',
        style.bgClass, style.borderClass,
      )}
    >
      <Handle type="target" position={Position.Top}    className="!opacity-0" />
      <Handle type="target" position={Position.Bottom} className="!opacity-0" />
      <Handle type="target" position={Position.Left}   className="!opacity-0" />
      <Handle type="target" position={Position.Right}  className="!opacity-0" />
      <Handle type="source" position={Position.Top}    className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle type="source" position={Position.Left}   className="!opacity-0" />
      <Handle type="source" position={Position.Right}  className="!opacity-0" />
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3 w-3', style.headerClass)} />
        <span className={cn('text-[9px] font-bold uppercase tracking-wider', style.headerClass)}>{style.header}</span>
      </div>
      <p className="font-semibold text-sm text-foreground mt-1 leading-tight truncate">{data.title}</p>
      {data.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{data.subtitle}</p>}
      <div className="flex items-center gap-2 mt-1.5">
        {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />}
        {data.status && <span className="text-[10px] text-muted-foreground capitalize">{data.status}</span>}
        {data.meta && <span className="text-[10px] text-muted-foreground ml-auto truncate">{data.meta}</span>}
      </div>
    </div>
  );
}

const nodeTypes = { center: CenterNode, connected: ConnectedNode };

/* ---------- Test data filter ---------- */
function isTestProfile(p: { full_name?: string | null; email?: string | null } | null | undefined): boolean {
  if (!p) return false;
  const name = (p.full_name || '').toLowerCase();
  const email = (p.email || '').toLowerCase();
  if (name.includes('student') || name.includes('test')) return true;
  if (email.includes('test')) return true;
  return false;
}

/* ---------- Data fetchers ---------- */
async function fetchAsTeacher(teacherId: string) {
  const { data: assignments } = await supabase
    .from('student_teacher_assignments')
    .select('id, status, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, email), subject:subjects(name)')
    .eq('teacher_id', teacherId);
  return {
    students: (assignments || [])
      .filter((a: any) => a.student && !isTestProfile(a.student))
      .map((a: any) => ({ id: a.student.id, name: a.student.full_name || 'Unknown', subject: a.subject?.name || null, status: a.status })),
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
      .map((e: any) => ({ id: e.course?.id, name: e.course?.name, klass: null as string | null, status: e.status }))
      .filter((c: any) => c.id),
    classMemberships: (classMembershipsRes.data || [])
      .map((m: any) => ({ id: m.class?.id, name: m.class?.course?.name || m.class?.name, klass: m.class?.name || null, status: m.status }))
      .filter((c: any) => c.id),
  };
}

async function fetchAsParent(parentId: string) {
  const { data: links } = await supabase
    .from('student_parent_links')
    .select('student:profiles!student_parent_links_student_id_fkey(id, full_name, email)')
    .eq('parent_id', parentId);
  return {
    children: (links || [])
      .map((l: any) => l.student)
      .filter((s: any) => s && !isTestProfile(s))
      .map((s: any) => ({ id: s.id, name: s.full_name })),
  };
}

async function fetchSiblings(studentId: string) {
  const { data: parentLinks } = await supabase.from('student_parent_links').select('parent_id').eq('student_id', studentId);
  const parentIds = (parentLinks || []).map((p: any) => p.parent_id).filter(Boolean);
  if (!parentIds.length) return [] as Array<{ id: string; full_name: string }>;
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

async function fetchParentsOfStudent(studentId: string) {
  const { data: links } = await supabase
    .from('student_parent_links')
    .select('parent:profiles!student_parent_links_parent_id_fkey(id, full_name, whatsapp_number)')
    .eq('student_id', studentId);
  return (links || [])
    .map((l: any) => l.parent)
    .filter((p: any) => p && !isTestProfile(p))
    .map((p: any) => ({ id: p.id, name: p.full_name, phone: p.whatsapp_number }));
}

async function fetchUnifiedConnections(userId: string, hintedRole?: ConnUserType) {
  // CRITICAL: Pull ALL roles, no LIMIT, no early-return
  const { data: rolesRes } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  const allRoles: string[] = (rolesRes || []).map((r: any) => r.role);
  const roleSet = new Set<string>(allRoles);
  // NOTE: Do NOT infer roles from any other table (e.g. student_parent_links).
  // user_roles is the single source of truth for the role pills on the center node.
  // hintedRole is only used to decide which related-data fetches to run, never added to allRoles.

  const isTeacher = roleSet.has('teacher') || hintedRole === 'teacher';
  const isStudent = roleSet.has('student') || hintedRole === 'student';
  const isParent  = roleSet.has('parent')  || hintedRole === 'parent';

  const [profileRes, teacherData, studentData, parentData, siblings, parentsOfStudent] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('id', userId).maybeSingle(),
    isTeacher ? fetchAsTeacher(userId) : Promise.resolve(null),
    isStudent ? fetchAsStudent(userId) : Promise.resolve(null),
    isParent  ? fetchAsParent(userId)  : Promise.resolve(null),
    isStudent ? fetchSiblings(userId)  : Promise.resolve([] as any[]),
    isStudent ? fetchParentsOfStudent(userId) : Promise.resolve([] as any[]),
  ]);

  return {
    self: profileRes.data,
    allRoles: Array.from(roleSet),
    teacherData, studentData, parentData, siblings, parentsOfStudent,
  };
}

/* ---------- Layout (dagre per quadrant) ---------- */
const NODE_W = 220;
const NODE_H = 86;
const CENTER_W = 320;
const CENTER_H = 130;

interface Spoke { id: string; data: NodeData; rel: Exclude<RelKind, 'self'>; }

function layoutQuadrant(spokes: Spoke[], rankdir: 'TB' | 'BT' | 'LR' | 'RL') {
  if (!spokes.length) return [] as Array<Spoke & { x: number; y: number }>;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: 80, ranksep: 60, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  spokes.forEach((s) => g.setNode(s.id, { width: NODE_W, height: NODE_H }));
  for (let i = 0; i < spokes.length - 1; i++) g.setEdge(spokes[i].id, spokes[i + 1].id);
  dagre.layout(g);
  return spokes.map((s) => {
    const n = g.node(s.id);
    return { ...s, x: n.x, y: n.y };
  });
}

function buildGraph(
  data: Awaited<ReturnType<typeof fetchUnifiedConnections>>,
  filter: RoleFilter,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const selfId = data.self?.id || 'self';

  const above: Spoke[] = []; // Teachers
  const below: Spoke[] = []; // Courses
  const left: Spoke[]  = []; // Parents/guardians
  const right: Spoke[] = []; // Students + children + siblings

  const showT = (filter === 'all' || filter === 'teacher') && data.teacherData;
  const showS = (filter === 'all' || filter === 'student') && data.studentData;
  const showP = (filter === 'all' || filter === 'parent')  && data.parentData;

  if (showT) {
    data.teacherData!.students.forEach((s) => {
      right.push({ id: `t-st-${s.id}`, rel: 'student', data: { kind: 'student', title: s.name, subtitle: s.subject || undefined, status: s.status, navUserId: s.id, navUserType: 'student' } });
    });
  }

  if (showS) {
    data.studentData!.teachers.forEach((t) => {
      above.push({ id: `s-t-${t.id}`, rel: 'teacher', data: { kind: 'teacher', title: t.name, subtitle: t.subject || undefined, status: t.status, navUserId: t.id, navUserType: 'teacher' } });
    });
    data.studentData!.courses.forEach((c) => {
      below.push({ id: `s-c-${c.id}`, rel: 'course', data: { kind: 'course', title: c.name, subtitle: c.klass || undefined, status: c.status } });
    });
    data.studentData!.classMemberships.forEach((m) => {
      below.push({ id: `s-cm-${m.id}`, rel: 'course', data: { kind: 'course', title: m.name || 'Class', subtitle: m.klass || undefined, status: m.status } });
    });
    (data.siblings || []).forEach((s: any) => {
      right.push({ id: `s-sib-${s.id}`, rel: 'sibling', data: { kind: 'sibling', title: s.full_name, navUserId: s.id, navUserType: 'student' } });
    });
    (data.parentsOfStudent || []).forEach((p: any) => {
      left.push({ id: `s-p-${p.id}`, rel: 'parent', data: { kind: 'parent', title: p.name, subtitle: p.phone || undefined, navUserId: p.id, navUserType: 'parent' } });
    });
  }

  if (showP) {
    data.parentData!.children.forEach((c) => {
      right.push({ id: `p-ch-${c.id}`, rel: 'student', data: { kind: 'student', title: c.name, subtitle: 'My Child', navUserId: c.id, navUserType: 'student' } });
    });
  }

  const aboveLaid = layoutQuadrant(above, 'LR');
  const belowLaid = layoutQuadrant(below, 'LR');
  const leftLaid  = layoutQuadrant(left,  'TB');
  const rightLaid = layoutQuadrant(right, 'TB');

  const VERT_GAP = 200;
  const HORZ_GAP = 260;

  const aboveWidth = aboveLaid.length ? Math.max(...aboveLaid.map((n) => n.x)) : 0;
  aboveLaid.forEach((n) => {
    nodes.push({ id: n.id, type: 'connected', position: { x: n.x - aboveWidth / 2 - NODE_W / 2, y: -VERT_GAP - NODE_H }, data: n.data });
  });
  const belowWidth = belowLaid.length ? Math.max(...belowLaid.map((n) => n.x)) : 0;
  belowLaid.forEach((n) => {
    nodes.push({ id: n.id, type: 'connected', position: { x: n.x - belowWidth / 2 - NODE_W / 2, y: VERT_GAP }, data: n.data });
  });
  const leftHeight = leftLaid.length ? Math.max(...leftLaid.map((n) => n.y)) : 0;
  leftLaid.forEach((n) => {
    nodes.push({ id: n.id, type: 'connected', position: { x: -HORZ_GAP - NODE_W, y: n.y - leftHeight / 2 - NODE_H / 2 }, data: n.data });
  });
  const rightHeight = rightLaid.length ? Math.max(...rightLaid.map((n) => n.y)) : 0;
  rightLaid.forEach((n) => {
    nodes.push({ id: n.id, type: 'connected', position: { x: HORZ_GAP, y: n.y - rightHeight / 2 - NODE_H / 2 }, data: n.data });
  });

  const primaryRole = (data.allRoles || []).slice().sort((a, b) => {
    const ai = ROLE_PRIORITY.indexOf(a); const bi = ROLE_PRIORITY.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  })[0];
  const primaryLabel = primaryRole ? ROLE_PILL[primaryRole]?.label : undefined;
  nodes.push({
    id: selfId,
    type: 'center',
    position: { x: -CENTER_W / 2, y: -CENTER_H / 2 },
    data: { kind: 'self', title: data.self?.full_name || 'User', primaryRoleLabel: primaryLabel, roles: data.allRoles } as NodeData,
    draggable: false,
  });

  const allSpokes = [...aboveLaid, ...belowLaid, ...leftLaid, ...rightLaid];
  allSpokes.forEach((s) => {
    const style = EDGE_STYLE[s.rel];
    edges.push({
      id: `e-${s.id}`,
      source: selfId,
      target: s.id,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: style.color,
        strokeWidth: 2,
        strokeDasharray: style.dashed ? '6 4' : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: style.color, width: 18, height: 18 },
    });
  });

  return { nodes, edges, counts: { above: above.length, below: below.length, left: left.length, right: right.length } };
}

/* ---------- Inner ---------- */
function GraphInner({ userId, userType, roleFilter = 'all', compact = false, className }: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  const { data, isLoading } = useQuery({
    queryKey: ['user-connections-unified-v2', userId, userType],
    queryFn: () => fetchUnifiedConnections(userId, userType),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { nodes, edges, counts } = useMemo(() => {
    if (!data) return { nodes: [], edges: [], counts: { above: 0, below: 0, left: 0, right: 0 } };
    return buildGraph(data, roleFilter);
  }, [data, roleFilter]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const d = node.data as NodeData;
    if (d.navUserId && d.navUserType) {
      navigate(`/connections/${d.navUserType}/${d.navUserId}`);
    }
  }, [navigate]);

  const exportPng = useCallback(async () => {
    if (!containerRef.current) return;
    const viewport = containerRef.current.querySelector('.react-flow__viewport') as HTMLElement | null;
    const target = viewport || containerRef.current;
    try {
      const dataUrl = await toPng(target, { backgroundColor: '#ffffff', cacheBust: true, pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `connections-${data?.self?.full_name || 'user'}.png`;
      a.click();
    } catch (e) { console.error('Export failed', e); }
  }, [data]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', compact ? 'h-[320px]' : 'h-[680px]', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!nodes.length) {
    return (
      <div className={cn('flex items-center justify-center text-sm text-muted-foreground', compact ? 'h-[320px]' : 'h-[680px]', className)}>
        No connections found.
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('w-full rounded-lg border bg-white dark:bg-card relative overflow-hidden', compact ? 'h-[420px]' : 'h-[720px]', className)}>
      {!compact && (
        <>
          {counts.above > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">Teachers</span>
            </div>
          )}
          {counts.below > 0 && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">Courses</span>
            </div>
          )}
          {counts.left > 0 && (
            <div className="absolute top-1/2 left-3 -translate-y-1/2 -rotate-90 origin-left z-10 pointer-events-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">Guardians</span>
            </div>
          )}
          {counts.right > 0 && (
            <div className="absolute top-1/2 right-3 -translate-y-1/2 rotate-90 origin-right z-10 pointer-events-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">Students</span>
            </div>
          )}
        </>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!compact}
        nodesConnectable={false}
        elementsSelectable
        zoomOnScroll
        panOnDrag
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#e5e7eb" />
        <Controls position="bottom-left" showInteractive={false} className="!shadow-md" />
        {!compact && (
          <Panel position="top-right" className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fitView({ padding: 0.2, duration: 400 })} className="h-8 gap-1.5 bg-white">
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="text-xs">Fit</span>
            </Button>
            <Button size="sm" variant="outline" onClick={exportPng} className="h-8 gap-1.5 bg-white">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Export PNG</span>
            </Button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

/* ---------- Main ---------- */
export function UserConnectionsGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
