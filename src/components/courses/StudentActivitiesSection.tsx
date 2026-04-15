import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Layers, BookOpen, FlipHorizontal, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentActivitiesSectionProps {
  courseId: string;
}

export function StudentActivitiesSection({ courseId }: StudentActivitiesSectionProps) {
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Fetch latest pushed content kit using raw query to avoid type issues with new columns
  const { data: kit, isLoading } = useQuery({
    queryKey: ['student-pushed-kit', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_kits')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      // Filter for pushed_to_class in JS since it's a new column
      const pushed = (data || []).filter((k: any) => k.pushed_to_class === true);
      return pushed[0] as any || null;
    },
    enabled: !!courseId,
  });

  // Fetch slides
  const { data: slides = [] } = useQuery({
    queryKey: ['student-slides', kit?.id],
    queryFn: async () => {
      const { data } = await supabase.from('slides')
        .select('id, title, arabic_text, bullets, sort_order')
        .eq('kit_id', kit!.id)
        .order('sort_order');
      return (data || []) as any[];
    },
    enabled: !!kit?.id,
  });

  // Fetch flashcards
  const { data: flashcards = [] } = useQuery({
    queryKey: ['student-flashcards', kit?.id],
    queryFn: async () => {
      const { data } = await supabase.from('flashcards')
        .select('id, front, back, sort_order')
        .eq('kit_id', kit!.id)
        .order('sort_order');
      return (data || []) as any[];
    },
    enabled: !!kit?.id,
  });

  // Fetch quiz count
  const { data: quizCount = 0 } = useQuery({
    queryKey: ['student-quiz-count', kit?.id],
    queryFn: async () => {
      const { count } = await supabase.from('quiz_questions')
        .select('id', { count: 'exact', head: true })
        .eq('kit_id', kit!.id);
      return count || 0;
    },
    enabled: !!kit?.id,
  });

  if (isLoading) return <Skeleton className="h-24" />;
  if (!kit) return null;

  const activities = [
    { icon: BookOpen, label: 'Slides', count: slides.length, color: 'text-primary bg-primary/10', onClick: () => { setCurrentSlide(0); setSlidesOpen(true); } },
    { icon: FlipHorizontal, label: 'Flashcards', count: flashcards.length, color: 'text-accent bg-accent/10', onClick: () => { setCurrentFlashcard(0); setFlipped(false); setFlashcardsOpen(true); } },
    { icon: HelpCircle, label: 'Quiz', count: quizCount, color: 'text-secondary-foreground bg-secondary', onClick: () => {} },
  ].filter(a => a.count > 0);

  if (activities.length === 0) return null;

  return (
    <>
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" /> Today's Activities
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {activities.map(act => (
            <Card key={act.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={act.onClick}>
              <CardContent className="p-3 text-center">
                <div className={cn('h-8 w-8 rounded-full mx-auto mb-1.5 flex items-center justify-center', act.color)}>
                  <act.icon className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium">{act.label}</p>
                <Badge variant="secondary" className="text-[10px] mt-1">{act.count}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Slides Modal */}
      <Dialog open={slidesOpen} onOpenChange={setSlidesOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Slides ({currentSlide + 1}/{slides.length})</DialogTitle>
          </DialogHeader>
          {slides[currentSlide] && (
            <div className="space-y-4 py-4">
              <h2 className="text-lg font-bold text-center">{slides[currentSlide].title}</h2>
              {slides[currentSlide].arabic_text && (
                <p className="text-2xl text-center leading-loose" dir="rtl">
                  {slides[currentSlide].arabic_text}
                </p>
              )}
              {slides[currentSlide].bullets && (
                <ul className="space-y-2 list-disc pl-5">
                  {(slides[currentSlide].bullets as string[])?.map((b: string, i: number) => (
                    <li key={i} className="text-sm">{b}</li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" size="sm" disabled={currentSlide === 0}
                  onClick={() => setCurrentSlide(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground">{currentSlide + 1} / {slides.length}</span>
                <Button variant="outline" size="sm" disabled={currentSlide === slides.length - 1}
                  onClick={() => setCurrentSlide(p => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Flashcards Modal */}
      <Dialog open={flashcardsOpen} onOpenChange={setFlashcardsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Flashcards ({currentFlashcard + 1}/{flashcards.length})</DialogTitle>
          </DialogHeader>
          {flashcards[currentFlashcard] && (
            <div className="space-y-4 py-4">
              <Card className="min-h-[200px] cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setFlipped(f => !f)}>
                <CardContent className="p-6 flex items-center justify-center min-h-[200px]">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">{flipped ? 'Answer' : 'Question'}</p>
                    <p className={cn('font-medium', flipped ? 'text-primary' : 'text-foreground')}>
                      {flipped ? flashcards[currentFlashcard].back : flashcards[currentFlashcard].front}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-4">Tap to flip</p>
                  </div>
                </CardContent>
              </Card>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" disabled={currentFlashcard === 0}
                  onClick={() => { setCurrentFlashcard(p => p - 1); setFlipped(false); }}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground">{currentFlashcard + 1} / {flashcards.length}</span>
                <Button variant="outline" size="sm" disabled={currentFlashcard === flashcards.length - 1}
                  onClick={() => { setCurrentFlashcard(p => p + 1); setFlipped(false); }}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
