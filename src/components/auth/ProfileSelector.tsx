import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Plus, Settings } from 'lucide-react';

interface ProfileOption {
  id: string;
  full_name: string;
  role: string;
  avatar_initial: string;
  color: string;
}

const ROLE_COLORS: Record<string, string> = {
  parent: 'bg-primary',
  teacher: 'bg-teal',
  admin: 'bg-gold',
  super_admin: 'bg-destructive',
  student: 'bg-sky',
  examiner: 'bg-secondary',
};

const ROLE_LABELS: Record<string, string> = {
  parent: 'Parent',
  teacher: 'Teacher',
  admin: 'Admin',
  super_admin: 'Super Admin',
  student: 'Student',
  examiner: 'Examiner',
  admin_admissions: 'Admissions',
  admin_fees: 'Fees Admin',
  admin_academic: 'Academic Admin',
};

export function ProfileSelector() {
  const { user, profile, setActiveRole } = useAuth();
  const navigate = useNavigate();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['profile-selector', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get all roles for this user
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const userRoles = roles?.map(r => r.role) || [];

      // Get linked children if parent
      const { data: children } = await supabase
        .from('student_parent_links')
        .select('student_id, student:profiles!student_parent_links_student_id_fkey(id, full_name)')
        .eq('parent_id', user.id);

      const options: ProfileOption[] = [];

      // Add the user's own roles
      for (const role of userRoles) {
        options.push({
          id: `${user.id}-${role}`,
          full_name: profile?.full_name || 'You',
          role: role,
          avatar_initial: (profile?.full_name || 'U')[0].toUpperCase(),
          color: ROLE_COLORS[role] || 'bg-muted',
        });
      }

      // Add children profiles for quick-switch
      if (children?.length) {
        for (const link of children) {
          const child = link.student as any;
          if (child) {
            options.push({
              id: `${child.id}-student`,
              full_name: child.full_name || 'Child',
              role: 'child_view',
              avatar_initial: (child.full_name || 'C')[0].toUpperCase(),
              color: 'bg-sky',
            });
          }
        }
      }

      return options;
    },
    enabled: !!user?.id,
  });

  const handleSelect = (option: ProfileOption) => {
    if (option.role === 'child_view') {
      // Navigate to parent dashboard with child focus
      navigate('/dashboard');
    } else if (setActiveRole) {
      setActiveRole(option.role as any);
      navigate('/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-lg mx-auto p-8">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="w-28 h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // If only one profile, skip selector
  if (profiles && profiles.length <= 1) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <Users className="w-10 h-10 text-primary mx-auto mb-3" />
        <h1 className="text-2xl font-black text-foreground">Who's using?</h1>
        <p className="text-sm text-muted-foreground mt-1">Select your profile to continue</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 max-w-lg">
        {profiles?.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option)}
            className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-lg transition-all duration-200"
          >
            <div className={`w-16 h-16 rounded-xl ${option.color} flex items-center justify-center text-white text-xl font-black group-hover:scale-110 transition-transform`}>
              {option.avatar_initial}
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground truncate max-w-[120px]">{option.full_name}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                {option.role === 'child_view' ? '👶 Child View' : ROLE_LABELS[option.role] || option.role}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
