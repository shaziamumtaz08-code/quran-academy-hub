import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

interface ParentFeedbackFormProps {
  ticketId: string;
  onSubmitted: () => void;
}

const RATING_FIELDS = [
  { key: 'overall', label: 'Overall Satisfaction' },
  { key: 'teaching_quality', label: 'Teaching Quality' },
  { key: 'communication', label: 'Communication' },
  { key: 'schedule', label: 'Schedule Convenience' },
  { key: 'progress', label: 'Child Progress' },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" onClick={() => onChange(star)} className="focus:outline-none">
          <Star
            className={`h-5 w-5 transition-colors ${star <= value ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`}
          />
        </button>
      ))}
    </div>
  );
}

export function ParentFeedbackForm({ ticketId, onSubmitted }: ParentFeedbackFormProps) {
  const { profile } = useAuth();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');

  const submit = useMutation({
    mutationFn: async () => {
      const metadata = {
        type: 'parent_feedback',
        ratings,
        would_recommend: wouldRecommend,
      };
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        author_id: profile!.id,
        message: comments || 'Feedback submitted',
        metadata,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Thank you for your feedback!');
      onSubmitted();
    },
    onError: () => toast.error('Failed to submit feedback'),
  });

  const allRated = RATING_FIELDS.every(f => ratings[f.key] && ratings[f.key] > 0);

  return (
    <div className="space-y-4 p-4 bg-accent/5 border border-accent/20 rounded-lg">
      <h4 className="font-medium text-sm">Monthly Feedback</h4>
      
      {RATING_FIELDS.map(field => (
        <div key={field.key} className="flex items-center justify-between">
          <Label className="text-sm">{field.label}</Label>
          <StarRating value={ratings[field.key] || 0} onChange={v => setRatings(prev => ({ ...prev, [field.key]: v }))} />
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Label className="text-sm">Would you recommend us?</Label>
        <div className="flex gap-2">
          <Button size="sm" variant={wouldRecommend === true ? 'default' : 'outline'} onClick={() => setWouldRecommend(true)}>Yes</Button>
          <Button size="sm" variant={wouldRecommend === false ? 'destructive' : 'outline'} onClick={() => setWouldRecommend(false)}>No</Button>
        </div>
      </div>

      <div>
        <Label className="text-xs">Additional Comments</Label>
        <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Any other feedback..." className="min-h-[60px]" />
      </div>

      <Button className="w-full" disabled={!allRated || wouldRecommend === null || submit.isPending} onClick={() => submit.mutate()}>
        {submit.isPending ? 'Submitting...' : 'Submit Feedback'}
      </Button>
    </div>
  );
}
