import { Crown, Shield, GraduationCap, User as UserIcon, Heart, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';

const ROLE_META: Record<string, { label: string; Icon: typeof Crown; bg: string; text: string; dot: string }> = {
  super_admin:      { label: 'Super Admin', Icon: Crown,          bg: 'bg-red-100 dark:bg-red-500/15',       text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500' },
  admin:            { label: 'Admin',       Icon: Shield,         bg: 'bg-red-100/70 dark:bg-red-500/10',    text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500' },
  admin_admissions: { label: 'Admissions',  Icon: Shield,         bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500' },
  admin_fees:       { label: 'Fees',        Icon: Shield,         bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  admin_academic:   { label: 'Academic',    Icon: Shield,         bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  teacher:          { label: 'Teacher',     Icon: GraduationCap,  bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500' },
  examiner:         { label: 'Examiner',    Icon: ClipboardList,  bg: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  student:          { label: 'Student',     Icon: UserIcon,       bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  parent:           { label: 'Parent',      Icon: Heart,          bg: 'bg-amber-100 dark:bg-amber-500/15',   text: 'text-amber-800 dark:text-amber-300',   dot: 'bg-amber-500' },
};

interface RoleBadgeProps {
  role: AppRole | string;
  size?: 'xs' | 'sm';
  showIcon?: boolean;
  label?: string;
  className?: string;
}

export function RoleBadge({ role, size = 'sm', showIcon = true, label, className }: RoleBadgeProps) {
  const m = ROLE_META[role] || ROLE_META.student;
  const Icon = m.Icon;
  const sizeCls = size === 'xs' ? 'text-[10px] px-1.5 py-0 h-5 gap-1' : 'text-xs px-2 py-0.5 gap-1.5';
  const iconCls = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <span className={cn('inline-flex items-center rounded-full font-medium', m.bg, m.text, sizeCls, className)}>
      {showIcon ? <Icon className={iconCls} strokeWidth={2.25} /> : <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />}
      <span>{label || m.label}</span>
    </span>
  );
}

export { ROLE_META };
