import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DMApprovalInboxProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DMApprovalInbox({ courseId, open, onOpenChange }: DMApprovalInboxProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingRequests = [], isLoading } = useQuery({
    queryKey: ['pending-dm-requests', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('dm_requests')
        .select('id, requester_id, recipient_id, created_at, status')
        .eq('course_id', courseId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (!data?.length) return [];

      // Fetch profiles for all involved users
      const userIds = [...new Set(data.flatMap(r => [r.requester_id, r.recipient_id]))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      
      const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name || 'User']));
      
      return data.map(r => ({
        ...r,
        requesterName: nameMap.get(r.requester_id) || 'User',
        recipientName: nameMap.get(r.recipient_id) || 'User',
      }));
    },
    enabled: open && !!courseId,
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = pendingRequests.find(r => r.id === requestId);
      if (!request) throw new Error('Request not found');

      // Update request status
      const { error: updateErr } = await supabase
        .from('dm_requests')
        .update({ status: 'approved', reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId);
      if (updateErr) throw updateErr;

      // Find the pre-created DM group and activate it
      const { data: groups } = await supabase
        .from('chat_groups')
        .select('id')
        .eq('course_id', courseId)
        .eq('is_dm', true)
        .eq('is_active', false);
      
      if (groups?.length) {
        for (const g of groups) {
          const { data: members } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('group_id', g.id);
          const mIds = members?.map(m => m.user_id) || [];
          if (mIds.includes(request.requester_id) && mIds.includes(request.recipient_id)) {
            await supabase.from('chat_groups').update({ is_active: true }).eq('id', g.id);
            break;
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('DM request approved');
      queryClient.invalidateQueries({ queryKey: ['pending-dm-requests', courseId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const declineMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('dm_requests')
        .update({ status: 'rejected', reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('DM request declined');
      queryClient.invalidateQueries({ queryKey: ['pending-dm-requests', courseId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pending DM Requests</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
          ) : pendingRequests.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </div>
          ) : (
            pendingRequests.map(req => (
              <div key={req.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{req.requesterName}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">{req.recipientName}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(req.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(req.id)}
                  >
                    {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    disabled={declineMutation.isPending}
                    onClick={() => declineMutation.mutate(req.id)}
                  >
                    {declineMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1" />}
                    Decline
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
