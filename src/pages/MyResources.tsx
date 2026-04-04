import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Video, Image, Link, ExternalLink, FolderOpen } from 'lucide-react';

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
        .select('id, resource_id, assigned_by, created_at, notes')
        .eq('assigned_to', user.id);

      // Fetch the actual resources for assignments
      const resourceIds = (assignments || []).map(a => a.resource_id);
      let assignedResources: any[] = [];
      if (resourceIds.length) {
        const { data: res } = await supabase.from('resources').select('*').in('id', resourceIds);
        assignedResources = (res || []).map(r => ({
          ...r,
          isAssigned: true,
          assignedAt: assignments?.find(a => a.resource_id === r.id)?.created_at,
        }));
      }

      // Get global resources visible to this role
      const { data: globalResources } = await supabase
        .from('resources')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      // Filter by visibility
      const visibleGlobal = (globalResources || []).filter(r => {
        if (r.visibility === 'all') return true;
        if (r.visibility === 'teachers' && activeRole === 'teacher') return true;
        if (r.visibility === 'students' && activeRole === 'student') return true;
        if (r.visible_to_roles?.includes(activeRole || '')) return true;
        return false;
      });

      const assignedIds = new Set(assignedResources.map(a => a.id));
      const globalItems = visibleGlobal
        .filter(r => !assignedIds.has(r.id))
        .map(r => ({ ...r, isAssigned: false }));

      return [...assignedResources, ...globalItems];
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
                    {typeIcons[res.type] || <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-bold text-foreground truncate">{res.title}</p>
                      {res.isAssigned && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 px-1.5 py-0 h-4">Assigned</Badge>}
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 capitalize">{res.type}</Badge>
                    </div>
                    {res.tags && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{res.tags}</p>
                    )}
                  </div>
                  {res.url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={res.url} target="_blank" rel="noopener">
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
