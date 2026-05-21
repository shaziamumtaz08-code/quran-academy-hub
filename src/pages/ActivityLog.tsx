import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Download, Search, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { categorizeAction, categoryStyles, humanizeAction } from "@/lib/activityLogger";

const ACTION_GROUPS = [
  'role_changed', 'credentials_reset',
  'assignment_status_changed', 'enrollment_status_changed',
  'invoice_status_changed', 'payment_recorded',
  'course_status_changed', 'lead_status_changed',
  'profile_created', 'profile_updated', 'profile_archived',
  'attendance_marked', 'attendance_edited',
  'login_success', 'login_failed',
];

const ENTITY_TYPES = [
  'profile', 'user', 'assignment', 'enrollment', 'invoice',
  'course', 'lead', 'attendance', 'auth',
];

export default function ActivityLog() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs', actionFilter, entityFilter, from, to],
    queryFn: async () => {
      let q = (supabase as any).from('system_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (actionFilter !== 'all') q = q.eq('action', actionFilter);
      if (entityFilter !== 'all') q = q.eq('entity_type', entityFilter);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to + 'T23:59:59');
      const { data } = await q;
      return data || [];
    },
  });

  // Optional actor role filter (resolved client-side from user_roles)
  const { data: rolesMap } = useQuery({
    queryKey: ['actor-roles', logs?.length],
    enabled: !!logs && logs.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((logs || []).map((l: any) => l.user_id).filter(Boolean))) as string[];
      if (ids.length === 0) return {} as Record<string, string>;
      const { data } = await supabase.from('user_roles').select('user_id, role').in('user_id', ids);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { if (!map[r.user_id]) map[r.user_id] = r.role; });
      return map;
    },
  });

  const filtered = useMemo(() => {
    let rows = logs || [];
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter((r: any) =>
        r.user_full_name?.toLowerCase().includes(s) ||
        r.entity_label?.toLowerCase().includes(s) ||
        r.user_email?.toLowerCase().includes(s)
      );
    }
    if (roleFilter !== 'all' && rolesMap) {
      rows = rows.filter((r: any) => rolesMap[r.user_id] === roleFilter);
    }
    return rows;
  }, [logs, search, roleFilter, rolesMap]);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const rows = [['Timestamp', 'Actor', 'Email', 'Action', 'Entity Type', 'Entity', 'Division', 'Old', 'New']];
    filtered.forEach((l: any) => rows.push([
      l.created_at, l.user_full_name || '', l.user_email || '', l.action,
      l.entity_type, l.entity_label || l.entity_id || '', l.division_id || '',
      JSON.stringify(l.old_values || {}), JSON.stringify(l.new_values || {}),
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <PageShell title="Activity Log" description="System-wide audit trail of user actions.">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {['super_admin', 'admin', 'teacher', 'student', 'parent', 'examiner'].map((r) => (
                  <SelectItem key={r} value={r}>{humanizeAction(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ACTION_GROUPS.map((a) => <SelectItem key={a} value={a}>{humanizeAction(a)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {ENTITY_TYPES.map((e) => <SelectItem key={e} value={e}>{humanizeAction(e)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search actor / entity..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No activity recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-2 w-8"></th>
                      <th className="text-left p-2">Timestamp</th>
                      <th className="text-left p-2">Actor</th>
                      <th className="text-left p-2">Action</th>
                      <th className="text-left p-2">Entity</th>
                      <th className="text-left p-2">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((log: any) => {
                      const cat = categorizeAction(log.action);
                      const styles = categoryStyles(cat);
                      const isOpen = expanded.has(log.id);
                      const ov = log.old_values || {};
                      const nv = log.new_values || {};
                      const diffKeys = Array.from(new Set([...Object.keys(ov), ...Object.keys(nv)]));
                      const actorRole = rolesMap?.[log.user_id];
                      return (
                        <>
                          <tr key={log.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleRow(log.id)}>
                            <td className="p-2">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </td>
                            <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'MMM d, HH:mm')}
                            </td>
                            <td className="p-2">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{log.user_full_name}</span>
                                {actorRole && <Badge variant="outline" className="w-fit text-[10px] mt-0.5">{actorRole}</Badge>}
                              </div>
                            </td>
                            <td className="p-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles.pill}`}>
                                {humanizeAction(log.action)}
                              </span>
                            </td>
                            <td className="p-2 text-foreground">{log.entity_label || log.entity_id || '—'}</td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1">
                                {diffKeys.slice(0, 2).map((k) => (
                                  <span key={k} className="inline-flex items-center gap-1 text-[10px]">
                                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">{String(ov[k] ?? '—')}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">{String(nv[k] ?? '—')}</span>
                                  </span>
                                ))}
                                {diffKeys.length > 2 && <span className="text-xs text-muted-foreground">+{diffKeys.length - 2}</span>}
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={log.id + '-d'} className="bg-muted/20">
                              <td colSpan={6} className="p-3">
                                <pre className="text-[11px] bg-card border border-border rounded p-3 overflow-x-auto">
                                  {JSON.stringify({
                                    details: log.details, old_values: log.old_values, new_values: log.new_values,
                                    division_id: log.division_id, branch_id: log.branch_id, ip_address: log.ip_address,
                                  }, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
