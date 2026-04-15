import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BookOpen, Layers, CheckCircle2, Send, Clock, Sparkles, GraduationCap,
  Loader2, ChevronDown, ExternalLink, RefreshCw, Eye, Mic
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
  const [planPopoverOpen, setPlanPopoverOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);

  // ─── Fetch session plans for this course ───
  const { data: sessionPlans = [], isLoading } = useQuery({
    queryKey: ['teach-today-plans', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('session_plans')
        .select('id, session_title, session_objective, activities, objectives, created_at, syllabus_id, course_id')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!courseId,
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Auto-select first plan
  useEffect(() => {
    if (sessionPlans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(sessionPlans[0].id);
    }
  }, [sessionPlans, selectedPlanId]);

  const activePlan = sessionPlans.find((p: any) => p.id === selectedPlanId) || sessionPlans[0];

  // ─── Content kit for selected plan ───
  const { data: contentKit, isLoading: kitLoading } = useQuery({
    queryKey: ['teach-today-kit', activePlan?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_kits')
        .select('*')
        .eq('session_plan_id', activePlan!.id)
        .limit(1);
      return (data?.[0] as any) || null;
    },
    enabled: !!activePlan?.id,
    refetchInterval: (query) => {
      const kit = query.state.data as any;
      return kit?.status === 'generating' ? 5000 : false;
    },
  });

  // ─── Count assets ───
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
    enabled: !!contentKit?.id && contentKit?.status === 'ready',
  });

  // ─── Slides for preview ───
  const { data: previewSlides = [] } = useQuery({
    queryKey: ['teach-today-slides-preview', contentKit?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('slides')
        .select('id, title, arabic_text, bullets, teacher_note, sort_order')
        .eq('kit_id', contentKit!.id)
        .order('sort_order');
      return (data || []) as any[];
    },
    enabled: !!contentKit?.id && previewOpen,
  });

  // ─── Parse activities ───
  const activities: Array<{ title: string; duration: number; description?: string; phase?: string }> =
    activePlan?.activities
      ? typeof activePlan.activities === 'string'
        ? JSON.parse(activePlan.activities)
        : activePlan.activities
      : [];

  const totalDuration = activities.reduce((sum, a) => sum + (a.duration || 0), 0);

  // ─── Parse objectives ───
  const objectives: string[] = activePlan?.objectives
    ? typeof activePlan.objectives === 'string'
      ? activePlan.objectives.split('\n').filter(Boolean)
      : Array.isArray(activePlan.objectives)
        ? activePlan.objectives
        : []
    : activePlan?.session_objective
      ? [activePlan.session_objective]
      : [];

  // ─── Push to students ───
  const handlePush = async (isRepush = false) => {
    if (!contentKit?.id) return;
    setPushing(true);
    try {
      const { error } = await supabase.from('content_kits')
        .update({ pushed_to_class: true, pushed_at: new Date().toISOString() } as any)
        .eq('id', contentKit.id);
      if (error) throw error;

      await supabase.from('course_notifications').insert({
        course_id: courseId,
        title: "New learning material for today's class",
        body: activePlan?.session_title || 'New content available',
      });

      queryClient.invalidateQueries({ queryKey: ['teach-today-kit', activePlan?.id] });
      toast.success(isRepush ? 'Content re-pushed to students' : '✓ Content pushed to all students');
    } catch (err: any) {
      toast.error(err.message || 'Failed to push content');
    } finally {
      setPushing(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
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

  const currentSlide = previewSlides[previewSlideIdx];

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4">
        {/* ═══ LEFT COLUMN — Session Plan (60%) ═══ */}
        <div className="lg:w-[60%] space-y-3">
          {/* Plan selector */}
          <div className="flex items-center justify-between">
            <Popover open={planPopoverOpen} onOpenChange={setPlanPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Switch Plan
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="start">
                <p className="text-xs font-medium text-muted-foreground px-2 pb-1.5">Session Plans</p>
                <div className="space-y-0.5 max-h-60 overflow-y-auto">
                  {sessionPlans.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPlanId(p.id); setPlanPopoverOpen(false); }}
                      className={`w-full text-left px-2 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors ${
                        p.id === activePlan?.id ? 'bg-muted font-medium' : ''
                      }`}
                    >
                      <p className="truncate">{p.session_title || 'Untitled plan'}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), 'MMM d, yyyy · h:mm a')}</p>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate(`/teaching-os/planner?course_id=${courseId}&session_id=${activePlan?.id}`)}
            >
              Edit in Teaching OS <ExternalLink className="h-3 w-3" />
            </Button>
          </div>

          {/* Plan content */}
          {activePlan && (
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Topic */}
                <h3 className="text-lg font-bold text-foreground">
                  {activePlan.session_title || 'Untitled Session'}
                </h3>

                {/* Objectives */}
                {objectives.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Objectives</p>
                    <ul className="space-y-1 list-disc list-inside">
                      {objectives.map((obj, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Activities Timeline */}
                {activities.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Activities</p>
                    <div className="space-y-2">
                      {activities.map((act, idx) => (
                        <Card key={idx} className="border-border/50">
                          <CardContent className="p-3 flex items-start gap-3">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-semibold text-foreground">{act.title}</p>
                                {act.phase && (
                                  <Badge variant="outline" className="text-[9px]">{act.phase}</Badge>
                                )}
                              </div>
                              {act.description && (
                                <p className="text-xs text-muted-foreground">{act.description}</p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              <Clock className="h-3 w-3 mr-0.5" />{act.duration}m
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-right">
                      Total: <span className="font-semibold">{totalDuration} min</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ═══ RIGHT COLUMN — Content Kit (40%) ═══ */}
        <div className="lg:w-[40%] space-y-3">
          {kitLoading ? (
            <Skeleton className="h-48" />
          ) : contentKit?.status === 'ready' ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Content Kit</h3>
                  {contentKit.pushed_to_class && (
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" /> Pushed
                    </Badge>
                  )}
                </div>

                {/* Counts */}
                {kitCounts && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { count: kitCounts.slides, label: 'Slides' },
                      { count: kitCounts.flashcards, label: 'Flashcards' },
                      { count: kitCounts.quizQuestions, label: 'Quiz Qs' },
                    ].map(({ count, label }) => (
                      <Card key={label} className="border-border/50">
                        <CardContent className="p-3 text-center">
                          <p className="text-lg font-bold">{count}</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Push actions */}
                {!contentKit.pushed_to_class ? (
                  <Button className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handlePush(false)} disabled={pushing}>
                    {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Push to Students
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">
                      Pushed {contentKit.pushed_at ? format(new Date(contentKit.pushed_at), 'MMM d, h:mm a') : ''}
                    </p>
                    <Button variant="outline" className="w-full gap-1.5" onClick={() => handlePush(true)} disabled={pushing}>
                      {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Push Again
                    </Button>
                  </div>
                )}

                {/* Preview */}
                <Button variant="outline" className="w-full gap-1.5" onClick={() => { setPreviewSlideIdx(0); setPreviewOpen(true); }}>
                  <Eye className="h-4 w-4" /> Preview Content
                </Button>
              </CardContent>
            </Card>
          ) : contentKit?.status === 'generating' ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Generating content...</p>
                <p className="text-xs text-muted-foreground mt-1">Auto-refreshing every 5 seconds</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No content kit ready</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Generate one in Teaching OS</p>
                <Button size="sm" onClick={() => navigate(`/teaching-os/content-kit?course_id=${courseId}&session_id=${activePlan?.id}`)}>
                  Generate Content Kit
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Separator + action buttons */}
          <div className="border-t pt-3 space-y-2">
            <Button
              variant="secondary"
              className="w-full gap-1.5"
              onClick={() => navigate(`/teaching-os/assessment?course_id=${courseId}`)}
            >
              <GraduationCap className="h-4 w-4" /> Start Assessment
            </Button>
            <Button
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => navigate(`/teaching-os/speaking-tutor?course_id=${courseId}`)}
            >
              <Mic className="h-4 w-4" /> Speaking Practice
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ Slide Preview Dialog ═══ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Content Preview
              {previewSlides.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-2">
                  {previewSlideIdx + 1} / {previewSlides.length}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {previewSlides.length === 0 ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : currentSlide ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">{currentSlide.title}</h3>

              {currentSlide.arabic_text && (
                <div className="bg-muted/40 rounded-lg p-4 text-right" dir="rtl">
                  <p className="text-xl leading-loose font-arabic">{currentSlide.arabic_text}</p>
                </div>
              )}

              {currentSlide.bullets && (
                <ul className="space-y-1.5 list-disc list-inside">
                  {(Array.isArray(currentSlide.bullets) ? currentSlide.bullets : []).map((b: string, i: number) => (
                    <li key={i} className="text-sm text-foreground">{b}</li>
                  ))}
                </ul>
              )}

              {currentSlide.teacher_note && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">Teacher Note</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{currentSlide.teacher_note}</p>
                </div>
              )}

              {/* Nav */}
              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={previewSlideIdx === 0}
                  onClick={() => setPreviewSlideIdx(i => i - 1)}
                >
                  ← Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={previewSlideIdx >= previewSlides.length - 1}
                  onClick={() => setPreviewSlideIdx(i => i + 1)}
                >
                  Next →
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
