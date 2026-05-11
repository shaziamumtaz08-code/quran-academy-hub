import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ChildrenDashboardView } from './shared/ChildrenDashboardView';

export function ParentDashboard() {
  const { user } = useAuth();

  const { data: studentIds = [], isLoading } = useQuery({
    queryKey: ['parent-linked-students', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: links } = await supabase
        .from('student_parent_links')
        .select('student_id')
        .eq('parent_id', user.id);
      return (links || []).map((l: any) => l.student_id);
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 max-w-[680px] mx-auto pt-16">
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
    );
  }

  return (
    <ChildrenDashboardView
      studentIds={studentIds}
      showFamilyManagement
      emptyMessage="No children linked. Contact an administrator to link your children."
    />
  );
}
