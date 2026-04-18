import React from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserConnectionsGraph, type ConnUserType } from '@/components/connections/UserConnectionsGraph';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Network } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const VALID_TYPES: ConnUserType[] = ['student', 'teacher', 'parent'];

export default function UserConnections() {
  const { userType, userId } = useParams<{ userType: string; userId: string }>();
  const navigate = useNavigate();

  if (!userType || !userId || !VALID_TYPES.includes(userType as ConnUserType)) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: profile } = useQuery({
    queryKey: ['conn-profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('full_name, registration_id').eq('id', userId).maybeSingle();
      return data;
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2 truncate">
                <Network className="h-5 w-5 text-primary shrink-0" />
                {profile?.full_name || 'User'} — Connections
              </h1>
              <p className="text-sm text-muted-foreground capitalize">
                {userType} relationships
                {profile?.registration_id ? ` · ${profile.registration_id}` : ''}
              </p>
            </div>
          </div>
        </div>

        <Card className="p-3">
          <UserConnectionsGraph userId={userId} userType={userType as ConnUserType} />
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Tip: drag nodes, scroll to zoom, click controls to fit the view.
        </p>
      </div>
    </DashboardLayout>
  );
}
