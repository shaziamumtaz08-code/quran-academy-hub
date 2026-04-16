import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  BarChart2, CalendarCheck, DollarSign, Users, GraduationCap, ShieldCheck, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HubCard {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string; // text color class for the icon
  iconBg: string;    // bg tint class for the icon container
  to: string;
}

const cards: HubCard[] = [
  {
    id: 'executive',
    title: 'Executive Dashboard',
    subtitle: 'Academy-wide KPIs & overview',
    icon: <BarChart2 className="h-5 w-5" />,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    to: '/reports?section=executive',
  },
  {
    id: 'attendance',
    title: 'Attendance & Accountability',
    subtitle: 'Sessions, punctuality & Zoom evidence',
    icon: <CalendarCheck className="h-5 w-5" />,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-500/10',
    to: '/reports?section=attendance',
  },
  {
    id: 'finance',
    title: 'Finance & Fees',
    subtitle: 'Collections, dues & trends',
    icon: <DollarSign className="h-5 w-5" />,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-500/10',
    to: '/reports?section=fees',
  },
  {
    id: 'people',
    title: 'People Performance',
    subtitle: 'Teacher KPIs & student engagement',
    icon: <Users className="h-5 w-5" />,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-500/10',
    to: '/reports?section=teacher',
  },
  {
    id: 'students',
    title: 'Student Reports & Cards',
    subtitle: 'Exam results, progress & report cards',
    icon: <GraduationCap className="h-5 w-5" />,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-500/10',
    to: '/student-reports',
  },
  {
    id: 'integrity',
    title: 'Integrity & Audit',
    subtitle: 'Data quality & mismatch checks',
    icon: <ShieldCheck className="h-5 w-5" />,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-500/10',
    to: '/integrity-audit',
  },
];

export default function ReportsLanding() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">Reports Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          KPIs, analytics, student reports, and data integrity
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => navigate(card.to)}
            className={cn(
              'group relative text-left rounded-xl border border-border bg-card p-5',
              'shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30',
              'transition-all duration-200'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', card.iconBg)}>
                <div className={card.iconColor}>{card.icon}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">{card.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
