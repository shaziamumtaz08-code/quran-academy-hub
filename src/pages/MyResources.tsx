import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { FileText, Video, Image, Link, ExternalLink, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';

const typeIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  link: <Link className="h-4 w-4" />,
};

export default function MyResources() {
  const { user, activeRole } = useAuth();

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['my-resources', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get assigned resources
      const { data: assignments } = await supabase
        .from('resource_assignments')
        .select('*, course_library_assets(*)')
        .eq('user_id', user.id);

      // Get global resources visible to this role
      const { data: globalResources } = await supabase
        .from('course_library_assets')
        .select('*')
        .or(`visibility.eq.all,visibility.eq.${activeRole === 'teacher' ? 'teachers' : 'students'}`)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20);

      // Merge: assigned take priority
      const assignedAssets = (assignments || []).map(a => ({
        ...a.course_library_assets,
        assignedAt: a.assigned_at,
        assignedBy: a.assigned_by,
        isAssigned: true,
      }));

      const assignedIds = new Set(assignedAssets.map(a => a.id));
      const globalItems = (globalResources || [])
        .filter(r => !assignedIds.has(r.id))
        .map(r => ({ ...r, isAssigned: false }));

      return [...assignedAssets, ...globalItems];
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-4 space-y-3 max-w-3xl mx-auto">
          <Skeleton className="h-8 w-48" />
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" /> My Resources
          </h1>
          <p className="text-sm text-muted-foreground">Materials assigned to you and shared globally</p>
        </div>

        {resources.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No resources available yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resources.map((res: any) => (
              <Card key={res.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    res.isAssigned ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {typeIcons[res.asset_type] || <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-bold text-foreground truncate">{res.title}</p>
                      {res.isAssigned && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 px-1.5 py-0 h-4">Assigned</Badge>}
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 capitalize">{res.asset_type}</Badge>
                    </div>
                    {res.tags?.length > 0 && (
                      <div className="flex gap-1 mt-0.5">
                        {res.tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {res.content_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={res.content_url} target="_blank" rel="noopener">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
