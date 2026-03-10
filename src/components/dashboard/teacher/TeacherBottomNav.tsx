import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'students', icon: '👩‍🎓', label: 'Students', path: '/students' },
  { id: 'plan', icon: '📅', label: 'Planning', path: '/monthly-planning' },
  { id: 'finance', icon: '💰', label: 'Salary', path: '/salary' },
];

export function TeacherBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex pt-2.5 pb-5 z-[200] md:hidden safe-area-bottom">
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className="flex-1 flex flex-col items-center bg-transparent border-none cursor-pointer gap-0.5"
          >
            <span className="text-xl">{tab.icon}</span>
            <span className={`text-[10px] font-bold ${isActive ? 'text-teal' : 'text-muted-foreground'}`}>
              {tab.label}
            </span>
            {isActive && (
              <div className="w-4 h-[3px] bg-teal rounded-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}
