import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckSquare, FileText, BarChart3, AlertTriangle, Wallet,
  Globe, CalendarOff, BookOpen, ClipboardList,
} from 'lucide-react';

type Tone = 'teal' | 'amber' | 'blue' | 'coral' | 'purple' | 'gray';

const toneStyles: Record<Tone, { bg: string; text: string }> = {
  teal:   { bg: 'bg-teal/10',        text: 'text-teal' },
  amber:  { bg: 'bg-gold/10',        text: 'text-gold' },
  blue:   { bg: 'bg-sky/10',         text: 'text-sky' },
  coral:  { bg: 'bg-destructive/10', text: 'text-destructive' },
  purple: { bg: 'bg-primary/10',     text: 'text-primary' },
  gray:   { bg: 'bg-secondary',      text: 'text-muted-foreground' },
};

export function TeacherQuickLinks() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const items: { icon: React.ElementType; label: string; tone: Tone; onClick: () => void }[] = [
    { icon: CheckSquare,    label: 'Mark attendance', tone: 'teal',   onClick: () => navigate('/attendance?tab=1on1') },
    { icon: FileText,       label: 'Lesson log',      tone: 'amber',  onClick: () => navigate('/attendance?tab=1on1') },
    { icon: BarChart3,      label: 'Reports',         tone: 'blue',   onClick: () => navigate('/student-reports') },
    { icon: AlertTriangle,  label: 'Missing',         tone: 'coral',  onClick: () => navigate('/attendance?tab=1on1&filter=missing') },
    { icon: Wallet,         label: 'My salary',       tone: 'purple', onClick: () => navigate('/salary') },
    { icon: Globe,          label: 'My network',      tone: 'gray',   onClick: () => navigate(`/connections/teacher/${user?.id}`) },
    { icon: CalendarOff,    label: 'Request leave',   tone: 'amber',  onClick: () => navigate('/work-hub?tab=leave') },
    { icon: BookOpen,       label: 'Library',         tone: 'blue',   onClick: () => navigate('/library') },
    { icon: ClipboardList,  label: 'Fill plan',       tone: 'teal',   onClick: () => navigate('/monthly-planning') },
  ];

  return (
    <div className="bg-card rounded-2xl p-3 md:p-4 border border-border shadow-card h-full">
      <p className="text-[12px] font-semibold text-muted-foreground mb-2.5">Quick links</p>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map(({ icon: Icon, label, tone, onClick }) => {
          const t = toneStyles[tone];
          return (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary transition-colors text-center"
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.bg} ${t.text}`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="text-[10px] leading-tight text-foreground">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
