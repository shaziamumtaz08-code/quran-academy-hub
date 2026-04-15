import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { MessageSquare, Loader2, Lock, Clock, XCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { findOrCreateCourseDM } from '@/lib/messaging';

interface ClassmatesDirectoryProps {
  courseId: string;
  classId: string | null;
  dmMode: string; // 'disabled' | 'teacher_only' | 'moderated' | 'open'
  userId: string;
  courseName: string;
  onOpenDM: (groupId: string, recipientName: string) => void;
}

export function ClassmatesDirectory({ courseId, classId, dmMode, userId, courseName, onOpenDM }: ClassmatesDirectoryProps) {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Fetch classmates
  const { data: classmates = [], isLoading } = useQuery({
    queryKey: ['classmates', classId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_class_students')
        .select('id, student_id, profile:profiles!course_class_students_student_id_fkey(id, full_name)')
        .eq('class_id', classId!)
        .eq('status', 'active');
      return (data || []).filter((s: any) => s.student_id !== userId);
    },
    enabled: !!classId,
  });

  // Fetch DM requests for this course involving this user
  const { data: dmRequests = [] } = useQuery({
    queryKey: ['dm-requests', courseId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('dm_requests')
        .select('id, requester_id, recipient_id, status')
        .eq('course_id', courseId)
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
      return data || [];
    },
    enabled: dmMode === 'moderated',
  });

  const getRequestStatus = (studentId: string) => {
    return dmRequests.find(
      r => (r.requester_id === userId && r.recipient_id === studentId) ||
           (r.requester_id === studentId && r.recipient_id === userId)
    );
  };

  // Fetch user profile name
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-name', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      return data;
    },
    enabled: !!userId,
  });

  const handleOpenDM = async (studentId: string, studentName: string) => {
    setLoadingId(studentId);
    try {
      const groupId = await findOrCreateCourseDM(
        userId, studentId, courseId, courseName,
        myProfile?.full_name || 'Student', studentName
      );
      if (groupId) {
        onOpenDM(groupId, studentName);
      } else {
        toast.error('Could not create conversation');
      }
    } catch {
      toast.error('Failed to open DM');
    } finally {
      setLoadingId(null);
    }
  };

  const handleRequestDM = async (studentId: string, studentName: string) => {
    setLoadingId(studentId);
    try {
      // Create DM group but inactive
      const { data: newGroup, error: gErr } = await supabase.from('chat_groups').insert({
        name: `${courseName} - DM Request`,
        type: 'course_dm',
        course_id: courseId,
        created_by: userId,
        is_dm: true,
        is_active: false,
        channel_mode: 'private',
      }).select('id').single();
      if (gErr) throw gErr;

      // Add members
      if (newGroup) {
        await supabase.from('chat_members').insert([
          { group_id: newGroup.id, user_id: userId, role: 'member' },
          { group_id: newGroup.id, user_id: studentId, role: 'member' },
        ]);
      }

      // Create DM request
      const { error } = await supabase.from('dm_requests').insert({
        requester_id: userId,
        recipient_id: studentId,
        course_id: courseId,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('DM request sent to moderator for approval');
      queryClient.invalidateQueries({ queryKey: ['dm-requests', courseId] });
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.info('Request already sent');
      } else {
        toast.error(err.message || 'Failed to send request');
      }
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  }

  if (classmates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No classmates found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-0 divide-y">
          {classmates.map((s: any) => {
            const name = s.profile?.full_name || 'Student';
            const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            const request = dmMode === 'moderated' ? getRequestStatus(s.student_id) : null;
            const isCurrentLoading = loadingId === s.student_id;

            return (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {initials}
                  </div>
                  <span className="text-sm font-medium">{name}</span>
                </div>

                {/* DM Button based on mode */}
                {dmMode === 'disabled' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" disabled className="text-xs h-7 opacity-50">
                        <Lock className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Direct messages are disabled for this course</TooltipContent>
                  </Tooltip>
                )}

                {dmMode === 'teacher_only' && null}

                {dmMode === 'moderated' && (
                  <>
                    {request?.status === 'pending' && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3" /> Request Sent
                      </Badge>
                    )}
                    {request?.status === 'rejected' && (
                      <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30">
                        <XCircle className="h-3 w-3" /> Declined
                      </Badge>
                    )}
                    {request?.status === 'approved' && (
                      <Button size="sm" variant="outline" className="text-xs h-7" disabled={isCurrentLoading}
                        onClick={() => handleOpenDM(s.student_id, name)}>
                        {isCurrentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {!request && (
                      <Button size="sm" variant="outline" className="text-xs h-7" disabled={isCurrentLoading}
                        onClick={() => handleRequestDM(s.student_id, name)}>
                        {isCurrentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Request DM</>}
                      </Button>
                    )}
                  </>
                )}

                {dmMode === 'open' && (
                  <Button size="sm" variant="outline" className="text-xs h-7" disabled={isCurrentLoading}
                    onClick={() => handleOpenDM(s.student_id, name)}>
                    {isCurrentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
