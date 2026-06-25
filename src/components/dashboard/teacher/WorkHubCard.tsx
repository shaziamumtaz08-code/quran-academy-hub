import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Smile, Plus } from 'lucide-react';

const CATEGORY_LABEL: Record<string, string> = {
  complaint: 'Complaint',
  feedback: 'Feedback',
  task: 'Task',
  leave: 'Leave',
};

export function WorkHubCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: tickets = [] } = useQuery({
    queryKey: ['teacher-workhub-card', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('tickets')
        .select('id, title, category, status')
        .eq('assignee_id', user!.id)
        .in('status', ['open', 'in_progress', 'pending'])
        .order('created_at', { ascending: false })
        .limit(2);
      return data || [];
    },
  });

  return (
    <div className="bg-card rounded-2xl p-3 md:p-4 border border-border shadow-card">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[12px] font-semibold text-muted-foreground">Work hub</p>
        <button
          onClick={() => navigate('/work-hub')}
          className="text-[11px] text-primary hover:underline"
        >
          Open hub →
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="flex items-start gap-2 py-1.5 border-b border-border">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[12px] text-foreground">No open tickets assigned to you</p>
            <p className="text-[10px] text-muted-foreground">All caught up ✓</p>
          </div>
        </div>
      ) : (
        tickets.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border">
            <p className="text-[12px] text-foreground truncate flex-1">{t.title}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                {CATEGORY_LABEL[t.category] || t.category}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky/10 text-sky border border-sky/20">
                {t.status}
              </span>
            </div>
          </div>
        ))
      )}

      <button
        onClick={() => navigate('/work-hub?tab=feedback')}
        className="flex items-start gap-2 py-1.5 w-full text-left"
      >
        <Smile className="w-3.5 h-3.5 text-sky mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[12px] text-foreground">Share feedback or a suggestion</p>
          <p className="text-[10px] text-muted-foreground">Work Hub → Feedback</p>
        </div>
      </button>

      <button
        onClick={() => navigate('/work-hub?action=new')}
        className="mt-2 w-full text-[12px] text-primary border border-border rounded-md py-1.5 flex items-center justify-center gap-1 hover:bg-secondary"
      >
        <Plus className="w-3.5 h-3.5" /> New ticket
      </button>
    </div>
  );
}
