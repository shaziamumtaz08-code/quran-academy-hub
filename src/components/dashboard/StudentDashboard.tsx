import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ChildrenDashboardView } from './shared/ChildrenDashboardView';

export function StudentDashboard() {
  const { user } = useAuth();
  if (!user?.id) return null;
  return (
    <ChildrenDashboardView
      studentIds={[user.id]}
      showChildToggle={false}
      emptyMessage="No data available yet"
    />
  );
}
