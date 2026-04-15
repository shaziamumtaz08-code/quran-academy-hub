import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CommunitySettingsSectionProps {
  courseId: string;
  courseName: string;
}

const DM_OPTIONS = [
  { value: 'disabled', label: 'Disabled', description: 'Students cannot DM teachers or each other' },
  { value: 'teacher_only', label: 'Teacher Only', description: 'Students can only DM their assigned teacher' },
  { value: 'moderated', label: 'Moderated', description: 'DMs are allowed but admins can review' },
  { value: 'open', label: 'Open', description: 'All students and staff can message each other freely' },
];

export function CommunitySettingsSection({ courseId, courseName }: CommunitySettingsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [communityEnabled, setCommunityEnabled] = useState(false);
  const [dmMode, setDmMode] = useState('disabled');
  const [saving, setSaving] = useState(false);

  // Fetch course settings
  const { data: course } = useQuery({
    queryKey: ['course-community-settings', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('community_chat_enabled, student_dm_mode')
        .eq('id', courseId)
        .single();
      return data;
    },
    enabled: !!courseId,
  });

  useEffect(() => {
    if (course) {
      setCommunityEnabled((course as any).community_chat_enabled || false);
      setDmMode((course as any).student_dm_mode || 'disabled');
    }
  }, [course]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('courses').update({
        community_chat_enabled: communityEnabled,
        student_dm_mode: dmMode,
      } as any).eq('id', courseId);
      if (error) throw error;

      // If community enabled, create community chat group if not exists
      if (communityEnabled) {
        const { data: existing } = await supabase
          .from('chat_groups')
          .select('id')
          .eq('course_id', courseId)
          .eq('channel_mode', 'community')
          .is('class_id' as any, null)
          .limit(1);

        if (!existing?.length && user?.id) {
          const { data: newGroup } = await supabase.from('chat_groups').insert({
            name: `${courseName} Community`,
            type: 'group',
            created_by: user.id,
            course_id: courseId,
            channel_mode: 'community',
            is_active: true,
            is_dm: false,
          }).select('id').single();

          if (newGroup) {
            // Add all enrolled students
            const { data: enrollments } = await supabase
              .from('course_enrollments')
              .select('student_id')
              .eq('course_id', courseId)
              .eq('status', 'active');

            if (enrollments?.length) {
              const members = enrollments.map(e => ({
                group_id: newGroup.id,
                user_id: e.student_id,
                role: 'member',
              }));
              await supabase.from('chat_members').insert(members);
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['course-community-settings', courseId] });
      toast.success('Community settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Community Settings</h3>
        </div>

        <Separator />

        {/* Community Chat Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Enable Community Chat</Label>
            <p className="text-xs text-muted-foreground">
              Create a shared chat group for all enrolled students
            </p>
          </div>
          <Switch checked={communityEnabled} onCheckedChange={setCommunityEnabled} />
        </div>

        <Separator />

        {/* DM Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Student Direct Messages</Label>
          <Select value={dmMode} onValueChange={setDmMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DM_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {DM_OPTIONS.find(o => o.value === dmMode)?.description}
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
          Save Community Settings
        </Button>
      </CardContent>
    </Card>
  );
}
