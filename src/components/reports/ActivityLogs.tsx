import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { format, subDays } from "date-fns";
import { useState } from "react";

const actionLabels: Record<string, string> = {
  attendance_marked: "Marked Attendance",
  attendance_updated: "Updated Attendance",
  attendance_deleted: "Deleted Attendance",
  user_created: "Created User",
  user_updated: "Updated User",
  user_deleted: "Deleted User",
  assignment_created: "Created Assignment",
  assignment_updated: "Updated Assignment",
  billing_plan_created: "Created Billing Plan",
  billing_plan_updated: "Updated Billing Plan",
  billing_plan_deleted: "Deleted Billing Plan",
  invoice_edited: "Edited Invoice",
  payment_recorded: "Recorded Payment",
  fee_package_created: "Created Fee Package",
  fee_package_updated: "Updated Fee Package",
  discount_created: "Created Discount",
  exam_created: "Created Exam",
  login: "Logged In",
  logout: "Logged Out",
};

export default function ActivityLogs() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", actionFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("system_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== "all") query = query.eq("action", actionFilter);

      const { data, count, error } = await query;
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    },
  });

  const filtered = (data?.logs || []).filter((log: any) => {
    if (!search) return true;
    return log.user_full_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by user or action..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground flex items-center">
              {data?.total || 0} total entries
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Time</th>
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Action</th>
                  <th className="text-left p-3 font-medium">Entity</th>
                  <th className="text-left p-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground whitespace-nowrap text-xs">
                      {format(new Date(log.created_at), "MMM d, HH:mm")}
                    </td>
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-sm">{log.user_full_name}</p>
                        {log.user_email && <p className="text-xs text-muted-foreground">{log.user_email}</p>}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{actionLabels[log.action] || log.action}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground capitalize">{log.entity_type?.replace(/_/g, " ")}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.details ? JSON.stringify(log.details).slice(0, 80) : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No activity logs found</td></tr>}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="text-sm text-primary disabled:text-muted-foreground">← Previous</button>
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-sm text-primary disabled:text-muted-foreground">Next →</button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
