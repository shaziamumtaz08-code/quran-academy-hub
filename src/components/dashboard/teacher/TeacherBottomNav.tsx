import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDivision } from '@/contexts/DivisionContext';

type Tab = { id: string; icon: string; label: string; path: string };

const BASE_TABS: Tab[] = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'students', icon: '👩‍🎓', label: 'Students', path: '/students' },
];

const PLAN_TAB: Tab = { id: 'plan', icon: '📅', label: 'Planning', path: '/monthly-planning' };
const FINANCE_TAB: Tab = { id: 'finance', icon: '💰', label: 'Salary', path: '/salary' };

export function TeacherBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeDivision } = useDivision();
  const isOneToOne = activeDivision?.model_type === 'one_to_one';

  // Monthly Planning is a 1:1-only feature — hide for Group Academy teachers
  const tabs: Tab[] = [
    ...BASE_TABS,
    ...(isOneToOne ? [PLAN_TAB] : []),
    FINANCE_TAB,
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex pt-2.5 pb-5 z-[200] md:hidden safe-area-bottom">
      {tabs.map((tab) => {
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
