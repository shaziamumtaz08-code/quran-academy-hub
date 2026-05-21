import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { Clock } from "lucide-react";
import { categorizeAction, categoryStyles, describeChange, humanizeAction } from "@/lib/activityLogger";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  entityType: string;
  entityId: string;
  limit?: number;
}

export function ActivityHistoryPanel({ entityType, entityId, limit = 50 }: Props) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-history', entityType, entityId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('system_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return data || [];
    },
    enabled: !!entityId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="relative pl-6">
        <div className="absolute left-[10px] top-2 bottom-2 w-px bg-border" />
        <ol className="space-y-4">
          {logs.map((log: any) => {
            const cat = categorizeAction(log.action);
            const styles = categoryStyles(cat);
            return (
              <li key={log.id} className="relative">
                <span className={`absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-background ${styles.dot}`} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">{describeChange(log)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${styles.pill} mr-2`}>
                        {humanizeAction(log.action)}
                      </span>
                      {log.user_full_name}
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground whitespace-nowrap cursor-help">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{format(new Date(log.created_at), 'PPpp')}</TooltipContent>
                  </Tooltip>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </TooltipProvider>
  );
}

export default ActivityHistoryPanel;
