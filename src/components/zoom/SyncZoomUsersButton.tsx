import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function useZoomUserSync() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<any>(null);

  const runSyncZoomUsers = React.useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-sync-account-users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ apply: true }),
      });
      const body = await resp.json();
      setSyncResult(body);
      if (body?.success) {
        const s = body.summary || {};
        toast({
          title: 'Zoom users synced',
          description: `${body.zoom_user_count} Zoom users • ${s.created || 0} created, ${s.updated || 0} updated, ${s.already_mapped || 0} already mapped`,
        });
        qc.invalidateQueries({ queryKey: ['zoom-accounts-list'] });
        qc.invalidateQueries({ queryKey: ['zoom-accounts'] });
      } else {
        toast({ title: 'Sync failed', description: body?.error || body?.hint || 'See details', variant: 'destructive' });
      }
    } catch (e: any) {
      setSyncResult({ error: e.message });
      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }, [qc, toast]);

  return { syncing, syncResult, runSyncZoomUsers, setSyncResult };
}

export function SyncZoomUsersButton({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'default' }) {
  const { syncing, syncResult, runSyncZoomUsers } = useZoomUserSync();
  const [open, setOpen] = React.useState(false);

  const handleClick = async () => {
    await runSyncZoomUsers();
    setOpen(true);
  };

  return (
    <Popover open={open && Boolean(syncResult)} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} variant="outline" className={cn('gap-2', className)} onClick={handleClick} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync Zoom Users
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm">
        {syncResult?.success ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Synced {syncResult.zoom_user_count} Zoom users
            </p>
            <p className="text-muted-foreground text-xs">
              Created {syncResult.summary?.created ?? 0} • Updated {syncResult.summary?.updated ?? 0} •
              Already mapped {syncResult.summary?.already_mapped ?? 0} • Failed {syncResult.summary?.failed ?? 0}
            </p>
            {(syncResult.teachers_without_zoom || []).length > 0 && (
              <div className="text-xs">
                <p className="font-medium">Teachers not in Zoom:</p>
                <p className="text-muted-foreground">
                  {(syncResult.teachers_without_zoom || []).map((t: any) => t.full_name || t.email).join(', ')}
                </p>
              </div>
            )}
            {(syncResult.unmatched_zoom_users || []).length > 0 && (
              <div className="text-xs">
                <p className="font-medium">Zoom users with no teacher match:</p>
                <p className="text-muted-foreground">
                  {(syncResult.unmatched_zoom_users || []).map((u: any) => u.email).join(', ')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span className="whitespace-pre-wrap">
              {syncResult?.error || 'Sync failed'}
              {syncResult?.hint ? ` — ${syncResult.hint}` : ''}
            </span>
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
