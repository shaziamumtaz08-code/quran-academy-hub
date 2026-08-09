import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';

interface LinkedChild {
  id: string;
  student_id: string;
  full_name: string;
  email: string | null;
  oversight_level: string;
}

export function FamilyManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: children, isLoading } = useQuery({
    queryKey: ['family-children', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: links } = await supabase
        .from('student_parent_links')
        .select(`
          id, student_id,
          student:profiles!student_parent_links_student_id_fkey(id, full_name, email)
        `)
        .eq('parent_id', user.id);

      // Fetch oversight levels separately to avoid type issues
      const linkIds = links?.map(l => l.id) || [];
      let oversightMap = new Map<string, string>();
      if (linkIds.length) {
        const { data: oversightData } = await supabase
          .from('student_parent_links')
          .select('id, oversight_level')
          .in('id', linkIds) as any;
        if (oversightData) {
          for (const o of oversightData) {
            oversightMap.set(o.id, o.oversight_level || 'none');
          }
        }
      }

      if (!links?.length) return [];

      return links.map(link => {
        const student = link.student as any;
        return {
          id: link.id,
          student_id: link.student_id,
          full_name: student?.full_name || 'Unknown',
          email: student?.email || null,
          oversight_level: oversightMap.get(link.id) || 'none',
        };
      }) as LinkedChild[];
    },
    enabled: !!user?.id,
  });

  const updateOversightMutation = useMutation({
    mutationFn: async ({ linkId, level }: { linkId: string; level: string }) => {
      const { error } = await (supabase
        .from('student_parent_links')
        .update({ oversight_level: level } as any)
        .eq('id', linkId));
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Updated', description: 'Oversight level changed.' });
      queryClient.invalidateQueries({ queryKey: ['family-children'] });
    },
  });

  if (isLoading) {
    return <div className="p-4 text-muted-foreground text-sm">Loading family...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-extrabold text-foreground">Family Members</h3>
      </div>

      {!children?.length ? (
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">No children linked yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {children.map(child => (
            <div key={child.id} className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky/10 flex items-center justify-center text-sky font-bold text-sm">
                    {child.full_name[0]}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground">{child.full_name}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Oversight toggle */}
                <select
                  value={child.oversight_level}
                  onChange={(e) => updateOversightMutation.mutate({ linkId: child.id, level: e.target.value })}
                  className="text-[10px] px-2 py-1 rounded-lg border border-border bg-background text-foreground font-semibold"
                >
                  <option value="none">No oversight</option>
                  <option value="notifications">Notifications only</option>
                  <option value="full">Full dashboard</option>
                </select>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
