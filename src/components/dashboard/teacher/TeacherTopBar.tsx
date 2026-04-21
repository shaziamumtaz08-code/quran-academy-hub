import React from 'react';
import { Bell, Menu, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TeacherTopBarProps {
  onMenuToggle?: () => void;
}

export function TeacherTopBar({ onMenuToggle }: TeacherTopBarProps) {
  const { profile, user } = useAuth();
  const { activeDivision, activeBranch, switcherOptions, setActiveDivisionId } = useDivision();

  // Fetch unread notification count
  const { data: unreadCount } = useQuery({
    queryKey: ['teacher-unread-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('notification_queue')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'T';

  // Build chip label (e.g. "Online HQ — Group Academy")
  const chipLabel = activeDivision
    ? (activeBranch?.name && activeBranch.name !== activeDivision.name
        ? `${activeBranch.name} — ${activeDivision.name}`
        : activeDivision.name)
    : null;

  const hasMultiple = (switcherOptions?.length ?? 0) > 1;

  const ChipInner = (
    <span className="inline-flex items-center gap-1 bg-white/[0.10] text-primary-foreground px-2 py-1 rounded-md text-[10px] font-semibold leading-none max-w-[150px]">
      <Building2 className="h-3 w-3 shrink-0 opacity-80" />
      <span className="truncate">{chipLabel}</span>
    </span>
  );

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-primary shadow-navy md:hidden">
      <div className="px-3 py-2.5 flex items-center gap-2 overflow-hidden">
        {/* Hamburger */}
        <button
          onClick={() => {
            onMenuToggle?.();
            window.dispatchEvent(new Event('teacher-menu-toggle'));
          }}
          className="bg-white/[0.08] border-none rounded-lg w-9 h-9 flex items-center justify-center text-primary-foreground shrink-0"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Logo mark */}
        <span className="text-[10px] text-sky/60 font-bold tracking-[1.5px] uppercase shrink-0">AQA</span>

        {/* Division chip — between AQA and greeting */}
        {chipLabel && (
          hasMultiple ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="shrink-0">{ChipInner}</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[300]">
                {switcherOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.divisionId}
                    onClick={() => setActiveDivisionId(opt.divisionId)}
                    className="text-xs"
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="shrink-0">{ChipInner}</span>
          )
        )}

        {/* Greeting — fills remaining space */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-primary-foreground/70 leading-tight">Assalamu Alaikum 👋</p>
          <p className="text-sm font-bold text-primary-foreground truncate leading-tight">{profile?.full_name || 'Teacher'}</p>
        </div>

        {/* Bell */}
        <button className="relative bg-white/[0.08] border-none rounded-lg w-9 h-9 flex items-center justify-center text-primary-foreground shrink-0">
          <Bell className="h-4 w-4" />
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-primary" />
          )}
        </button>

        {/* Avatar */}
        <div className="bg-teal rounded-lg w-9 h-9 flex items-center justify-center text-primary-foreground text-[11px] font-bold shrink-0">
          {initials}
        </div>
      </div>
    </div>
  );
}
