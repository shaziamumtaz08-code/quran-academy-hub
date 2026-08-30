import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Link2 } from 'lucide-react';

interface ZoomAccountRow {
  id: string;
  teacher_id: string | null;
  zoom_account_email: string | null;
  tier: string | null;
  is_active: boolean | null;
  profile?: { full_name?: string | null } | null;
}

const accountLabel = (a: ZoomAccountRow) =>
  `${a.profile?.full_name || a.zoom_account_email || 'Zoom account'}${a.tier ? ` · ${a.tier}` : ''}`;

/**
 * Admin controls for the Zoom Meeting SDK (in-app video player):
 *  1. Per-account Meeting SDK Client ID / Secret (stored via admin_set_zoom_meeting_sdk_creds)
 *  2. Linking a course class to the Zoom account that hosts it (course_classes.zoom_account_id)
 */
export function MeetingSdkPanel({ zoomAccounts }: { zoomAccounts: ZoomAccountRow[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activeAccounts = React.useMemo(
    () => (zoomAccounts || []).filter((a) => a.is_active !== false),
    [zoomAccounts],
  );

  const [credAccount, setCredAccount] = React.useState<string>('');
  const [sdkClientId, setSdkClientId] = React.useState('');
  const [sdkClientSecret, setSdkClientSecret] = React.useState('');
  const [savingCreds, setSavingCreds] = React.useState(false);

  const [classId, setClassId] = React.useState<string>('');
  const [linkAccount, setLinkAccount] = React.useState<string>('');
  const [savingLink, setSavingLink] = React.useState(false);

  // Which accounts already have Meeting SDK credentials (presence only, never the secret).
  const { data: credStatus } = useQuery({
    queryKey: ['zoom-sdk-cred-status'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zoom_accounts')
        .select('id, zoom_meeting_sdk_client_id');
      if (error) throw error;
      return Object.fromEntries((data || []).map((r: any) => [r.id, !!r.zoom_meeting_sdk_client_id])) as Record<string, boolean>;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ['course-classes-zoom-link'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('course_classes')
        .select('id, name, meeting_link, zoom_account_id, course:courses(title)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const selectedClass = React.useMemo(
    () => (classes || []).find((c: any) => c.id === classId),
    [classes, classId],
  );

  React.useEffect(() => {
    setLinkAccount(selectedClass?.zoom_account_id || '');
  }, [selectedClass?.id, selectedClass?.zoom_account_id]);

  const saveCreds = async () => {
    setSavingCreds(true);
    try {
      const { error } = await (supabase as any).rpc('admin_set_zoom_meeting_sdk_creds', {
        _account_id: credAccount,
        _client_id: sdkClientId,
        _client_secret: sdkClientSecret,
      });
      if (error) throw error;
      setSdkClientId('');
      setSdkClientSecret('');
      queryClient.invalidateQueries({ queryKey: ['zoom-sdk-cred-status'] });
      toast({ title: 'Meeting SDK credentials saved', description: 'Classes linked to this account can now use the in-app player.' });
    } catch (e: any) {
      toast({ title: 'Could not save credentials', description: e.message, variant: 'destructive' });
    } finally {
      setSavingCreds(false);
    }
  };

  const saveLink = async () => {
    setSavingLink(true);
    try {
      const { error } = await (supabase as any)
        .from('course_classes')
        .update({ zoom_account_id: linkAccount || null })
        .eq('id', classId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['course-classes-zoom-link'] });
      toast({ title: linkAccount ? 'Class linked' : 'Link cleared', description: linkAccount ? 'This class will use that account’s Meeting SDK app.' : 'This class falls back to the embedded frame.' });
    } catch (e: any) {
      toast({ title: 'Could not update class', description: e.message, variant: 'destructive' });
    } finally {
      setSavingLink(false);
    }
  };

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardContent className="p-4 space-y-5">
        {/* Meeting SDK credentials */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">In-app player credentials</h3>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="lg:w-64">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Zoom account</p>
              <Select value={credAccount} onValueChange={setCredAccount}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {accountLabel(a)}{credStatus?.[a.id] ? ' ✓' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Meeting SDK Client ID</p>
              <Input value={sdkClientId} onChange={(e) => setSdkClientId(e.target.value)} placeholder="Client ID from the Zoom “Meeting SDK” app" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Meeting SDK Client Secret</p>
              <Input type="password" value={sdkClientSecret} onChange={(e) => setSdkClientSecret(e.target.value)} placeholder="Client Secret" />
            </div>
            <Button size="sm" disabled={!credAccount || !sdkClientId || !sdkClientSecret || savingCreds} onClick={saveCreds}>
              {savingCreds ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {credAccount && credStatus?.[credAccount] && (
            <Badge variant="secondary" className="text-[10px]">Credentials already stored — saving replaces them</Badge>
          )}
          <p className="text-xs text-muted-foreground">
            These come from a separate <strong>Meeting SDK</strong> app in the Zoom Marketplace (not the Server-to-Server OAuth app). Accounts without them keep using the embedded frame.
          </p>
        </div>

        {/* Class → account link */}
        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">Link a class to its hosting account</h3>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Class</p>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {(c.course?.title ? `${c.course.title} — ` : '') + (c.name || 'Class')}{c.zoom_account_id ? ' ✓' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:w-72">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Zoom account</p>
              <Select value={linkAccount || '__none'} onValueChange={(v) => setLinkAccount(v === '__none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Not linked (use embedded frame)</SelectItem>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {accountLabel(a)}{credStatus?.[a.id] ? ' ✓' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={!classId || savingLink} onClick={saveLink}>
              {savingLink ? 'Saving…' : 'Save link'}
            </Button>
          </div>
          {selectedClass?.meeting_link && (
            <p className="text-xs text-muted-foreground break-all">
              Class meeting link: <code className="font-mono">{selectedClass.meeting_link}</code>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MeetingSdkPanel;
