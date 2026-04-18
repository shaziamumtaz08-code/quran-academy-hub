import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge, Position,
  useNodesState, useEdgesState, MarkerType, ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { toPng } from 'html-to-image';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Download, Database, KeyRound, Link2, Hash } from 'lucide-react';
import { toast } from 'sonner';

interface SchemaColumn {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  is_pk: boolean;
  is_fk: boolean;
  is_unique: boolean;
  ordinal: number;
}
interface SchemaTable { table_name: string; columns: SchemaColumn[]; }
interface SchemaFK {
  constraint_name: string;
  source_table: string; source_column: string;
  target_table: string; target_column: string;
}
interface SchemaPayload { tables: SchemaTable[]; foreign_keys: SchemaFK[]; }

const NODE_W = 280;
const ROW_H = 22;
const HEADER_H = 44;

function TableNode({ data }: { data: { table: SchemaTable; highlighted: boolean } }) {
  const { table, highlighted } = data;
  return (
    <div
      className={`bg-card border-2 rounded-lg shadow-md overflow-hidden transition-all ${
        highlighted ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      }`}
      style={{ width: NODE_W }}
    >
      <div className="bg-primary/10 px-3 py-2 border-b border-border flex items-center gap-2">
        <Database className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-xs font-bold text-foreground truncate">{table.table_name}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{table.columns.length}</span>
      </div>
      <div className="divide-y divide-border/50">
        {table.columns.map((c) => (
          <div key={c.column_name} className="px-3 py-1 flex items-center gap-1.5 text-[11px]" style={{ minHeight: ROW_H }}>
            {c.is_pk && <KeyRound className="w-3 h-3 text-amber-500 shrink-0" />}
            {c.is_fk && !c.is_pk && <Link2 className="w-3 h-3 text-blue-500 shrink-0" />}
            {c.is_unique && !c.is_pk && !c.is_fk && <Hash className="w-3 h-3 text-emerald-500 shrink-0" />}
            {!c.is_pk && !c.is_fk && !c.is_unique && <span className="w-3 h-3 shrink-0" />}
            <span className={`font-mono truncate ${c.is_nullable ? 'text-muted-foreground' : 'text-foreground'}`}>
              {c.column_name}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono truncate max-w-[80px]" title={c.data_type}>
              {c.data_type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

function layoutNodes(tables: SchemaTable[], fks: SchemaFK[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));

  tables.forEach((t) => {
    g.setNode(t.table_name, { width: NODE_W, height: HEADER_H + t.columns.length * ROW_H });
  });
  fks.forEach((fk) => {
    if (g.node(fk.source_table) && g.node(fk.target_table)) {
      g.setEdge(fk.source_table, fk.target_table);
    }
  });

  dagre.layout(g);

  const nodes: Node[] = tables.map((t) => {
    const pos = g.node(t.table_name);
    return {
      id: t.table_name,
      type: 'tableNode',
      position: { x: pos.x - NODE_W / 2, y: pos.y },
      data: { table: t, highlighted: false },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const edges: Edge[] = fks
    .filter((fk) => g.node(fk.source_table) && g.node(fk.target_table) && fk.source_table !== fk.target_table)
    .map((fk, i) => ({
      id: `${fk.constraint_name}-${i}`,
      source: fk.source_table,
      target: fk.target_table,
      label: `${fk.source_column} → ${fk.target_column}`,
      labelStyle: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' },
      labelBgStyle: { fill: 'hsl(var(--background))' },
      style: { stroke: 'hsl(var(--primary) / 0.4)', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
      animated: false,
    }));

  return { nodes, edges };
}

function SchemaExplorerInner() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { data, isLoading, error } = useQuery<SchemaPayload>({
    queryKey: ['schema-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_schema_overview' as any);
      if (error) throw error;
      return data as unknown as SchemaPayload;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return null;
    const q = search.trim().toLowerCase();
    if (!q) return data;
    const tables = data.tables.filter((t) => t.table_name.toLowerCase().includes(q));
    const names = new Set(tables.map((t) => t.table_name));
    const fks = data.foreign_keys.filter((f) => names.has(f.source_table) && names.has(f.target_table));
    return { tables, foreign_keys: fks };
  }, [data, search]);

  useEffect(() => {
    if (!filtered) return;
    const { nodes: n, edges: e } = layoutNodes(filtered.tables, filtered.foreign_keys);
    setNodes(n);
    setEdges(e);
  }, [filtered, setNodes, setEdges]);

  // Highlight related tables on selection
  useEffect(() => {
    if (!data) return;
    if (!selected) {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, highlighted: false } })));
      setEdges((eds) => eds.map((e) => ({ ...e, style: { ...e.style, stroke: 'hsl(var(--primary) / 0.4)', strokeWidth: 1.5 } })));
      return;
    }
    const related = new Set<string>([selected]);
    data.foreign_keys.forEach((f) => {
      if (f.source_table === selected) related.add(f.target_table);
      if (f.target_table === selected) related.add(f.source_table);
    });
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, highlighted: related.has(n.id) } })));
    setEdges((eds) => eds.map((e) => {
      const isRelated = e.source === selected || e.target === selected;
      return {
        ...e,
        style: {
          ...e.style,
          stroke: isRelated ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.15)',
          strokeWidth: isRelated ? 2.5 : 1,
        },
        animated: isRelated,
      };
    }));
  }, [selected, data, setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelected((prev) => (prev === node.id ? null : node.id));
  }, []);

  const handleExport = async () => {
    const el = wrapperRef.current?.querySelector('.react-flow') as HTMLElement | null;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: 'hsl(var(--background))',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `schema-${new Date().toISOString().split('T')[0]}.png`;
      a.click();
      toast.success('Schema exported');
    } catch (e: any) {
      toast.error('Export failed: ' + (e?.message || 'unknown'));
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-md text-center">
          <h2 className="font-bold text-lg mb-2">Access denied</h2>
          <p className="text-sm text-muted-foreground">{(error as any).message || 'Super admin access required.'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-lg">Schema Explorer</h1>
          {data && <Badge variant="secondary">{data.tables.length} tables · {data.foreign_keys.length} FKs</Badge>}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tables..."
            className="pl-8 h-9"
          />
        </div>
        {selected && (
          <Badge className="gap-1">
            Selected: {selected}
            <button onClick={() => setSelected(null)} className="ml-1 hover:opacity-70">×</button>
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><KeyRound className="w-3 h-3 text-amber-500" /> PK</span>
            <span className="flex items-center gap-1"><Link2 className="w-3 h-3 text-blue-500" /> FK</span>
            <span className="flex items-center gap-1"><Hash className="w-3 h-3 text-emerald-500" /> Unique</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> PNG
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapperRef} className="flex-1 relative">
        {isLoading ? (
          <div className="p-6 grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="hsl(var(--border))" gap={20} />
            <Controls className="!bg-card !border !border-border" />
            <MiniMap
              nodeColor={(n) => n.data.highlighted ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
              maskColor="hsl(var(--background) / 0.7)"
              className="!bg-card !border !border-border"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

export default function SchemaExplorer() {
  return (
    <ReactFlowProvider>
      <SchemaExplorerInner />
    </ReactFlowProvider>
  );
}
