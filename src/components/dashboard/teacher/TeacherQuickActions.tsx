import React from 'react';
import { useNavigate } from 'react-router-dom';

export function TeacherQuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: '🎥', label: 'Start Class', bg: 'bg-primary', textColor: 'text-primary-foreground', border: 'border-transparent', onClick: () => navigate('/zoom') },
    { icon: '✅', label: 'Mark Attendance', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/attendance?tab=1on1') },
    { icon: '📖', label: 'Lesson Log', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/attendance?tab=1on1') },
    { icon: '📊', label: 'Reports', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/reports') },
  ];

  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-2.5">
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`${a.bg} ${a.textColor} border ${a.border} rounded-2xl p-3.5 flex items-center gap-2 cursor-pointer text-left font-bold text-sm hover:opacity-90 transition-opacity`}
          >
            <span className="text-xl">{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
