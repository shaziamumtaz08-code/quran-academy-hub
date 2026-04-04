import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, AlertTriangle, TrendingUp, X } from 'lucide-react';

const riskColors: Record<string, string> = {
  critical: 'bg-destructive/10 border-destructive/20 text-destructive',
  high: 'bg-gold/10 border-gold/20 text-gold',
  medium: 'bg-sky/10 border-sky/20 text-sky',
  low: 'bg-teal/10 border-teal/20 text-teal',
};

export function AiInsightsWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: insights = [] } = useQuery({
    queryKey: ['ai-insights', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('ai_insights').update({ is_dismissed: true }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-insights'] }),
  });

  if (insights.length === 0) return null;

  return (
    <div>
      <p className="text-[13px] font-extrabold text-foreground mb-2 flex items-center gap-1.5">
        <Brain className="h-4 w-4 text-primary" /> AI Insights
      </p>
      <div className="space-y-2">
        {insights.map((ins: any) => {
          const rc = riskColors[ins.risk_level] || riskColors.low;
          return (
            <div key={ins.id} className={`rounded-xl border px-3 py-2.5 ${rc}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {ins.risk_level === 'critical' || ins.risk_level === 'high' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{ins.insight_text}</p>
                    <Badge variant="outline" className="text-[9px] mt-1 capitalize">{ins.risk_level}</Badge>
                  </div>
                </div>
                <button onClick={() => dismiss.mutate(ins.id)} className="shrink-0 opacity-60 hover:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
