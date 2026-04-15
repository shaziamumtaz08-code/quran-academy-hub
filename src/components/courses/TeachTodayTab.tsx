import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen, Layers, CheckCircle2, Send, Clock, Sparkles, GraduationCap, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TeachTodayTabProps {
  courseId: string;
}

export function TeachTodayTab({ courseId }: TeachTodayTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pushing, setPushing] = useState(false);

  // Fetch session plans for this course
  const { data: sessionPlans = [], isLoading } = useQuery({
    queryKey: ['teach-today-plans', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('session_plans')
        .select('id, topic, objectives, activities, created_at, syllabus_id')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!courseId,
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const activePlan = selectedPlanId
    ? sessionPlans.find(p => p.id === selectedPlanId)
    : sessionPlans[0];

  // Fetch linked content kit
  const { data: contentKit, isLoading: kitLoading } = useQuery({
    queryKey: ['teach-today-kit', activePlan?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_kits')
        .select('id, status, pushed_to_class, pushed_at, course_id')
        .eq('session_plan_id', activePlan!.id)
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!activePlan?.id,
  });

  // Count assets in kit
  const { data: kitCounts } = useQuery({
    queryKey: ['teach-today-kit-counts', contentKit?.id],
    queryFn: async () => {
      const [{ count: slides }, { count: flashcards }, { count: quizQuestions }] = await Promise.all([
        supabase.from('slides').select('id', { count: 'exact', head: true }).eq('kit_id', contentKit!.id),
        supabase.from('flashcards').select('id', { count: 'exact', head: true }).eq('kit_id', contentKit!.id),
        supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('kit_id', contentKit!.id),
      ]);
      return { slides: slides || 0, flashcards: flashcards || 0, quizQuestions: quizQuestions || 0 };
    },
    enabled: !!contentKit?.id,
  });

  const activities: Array<{ title: string; duration: number; type?: string }> = activePlan?.activities
    ? (typeof activePlan.activities === 'string' ? JSON.parse(activePlan.activities as string) : activePlan.activities as any[])
    : [];

  const handlePush = async () => {
    if (!contentKit?.id) return;
    setPushing(true);
    try {
      const { error } = await supabase.from('content_kits')
        .update({ pushed_to_class: true, pushed_at: new Date().toISOString() } as any)
        .eq('id', contentKit.id);
      if (error) throw error;

      // Create notification
      await supabase.from('course_notifications').insert({
        course_id: courseId,
        title: "New learning material for today's class",
        body: activePlan?.topic || 'New content available',
      });

      queryClient.invalidateQueries({ queryKey: ['teach-today-kit', activePlan?.id] });
      toast.success('Content pushed to students');
    } catch (err: any) {
      toast.error(err.message || 'Failed to push content');
    } finally {
      setPushing(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  }

  if (sessionPlans.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Sparkles className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No session plans yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Create a session plan in Teaching OS first</p>
          <Button size="sm" onClick={() => navigate(`/teaching-os/planner?course_id=${courseId}`)}>
            Open Teaching OS
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left panel: Session Plan (60%) */}
      <div className="lg:w-[60%] space-y-3">
        {/* Plan selector */}
        {sessionPlans.length > 1 && (
          <Select value={selectedPlanId || activePlan?.id || ''} onValueChange={setSelectedPlanId}>
            <SelectTrigger>
              <SelectValue placeholder="Select session plan" />
            </SelectTrigger>
            <SelectContent>
              {sessionPlans.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.topic || 'Untitled plan'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Active plan */}
        {activePlan && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">{activePlan.topic || 'Untitled'}</h3>
                </div>
                {activePlan.objectives && (
                  <p className="text-xs text-muted-foreground">{activePlan.objectives as string}</p>
                )}
              </div>

              {/* Activities */}
              {activities.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activities</p>
                  {activities.map((act, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/30">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{act.title}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        <Clock className="h-3 w-3 mr-0.5" />{act.duration}m
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right panel: Content Kit (40%) */}
      <div className="lg:w-[40%] space-y-3">
        {kitLoading ? (
          <Skeleton className="h-40" />
        ) : contentKit && contentKit.status === 'ready' ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Content Kit</h3>
                {(contentKit as any).pushed_to_class && (
                  <Badge className="bg-emerald-500 text-white text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Pushed
                  </Badge>
                )}
              </div>

              {/* Asset counts */}
              {kitCounts && (
                <div className="grid grid-cols-3 gap-2">
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold">{kitCounts.slides}</p>
                      <p className="text-[10px] text-muted-foreground">Slides</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold">{kitCounts.flashcards}</p>
                      <p className="text-[10px] text-muted-foreground">Flashcards</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold">{kitCounts.quizQuestions}</p>
                      <p className="text-[10px] text-muted-foreground">Quiz Qs</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Push button */}
              {!(contentKit as any).pushed_to_class ? (
                <Button className="w-full gap-1.5" onClick={handlePush} disabled={pushing}>
                  {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Push to Students
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Pushed {(contentKit as any).pushed_at ? format(new Date((contentKit as any).pushed_at), 'MMM d, h:mm a') : ''}
                </p>
              )}

              {/* Start Quiz */}
              <Button variant="outline" className="w-full gap-1.5"
                onClick={() => navigate(`/teaching-os/assessment?course_id=${courseId}`)}>
                <GraduationCap className="h-4 w-4" /> Start Quiz
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No content kit ready</p>
              <p className="text-xs text-muted-foreground mt-1">Generate one in Teaching OS</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
