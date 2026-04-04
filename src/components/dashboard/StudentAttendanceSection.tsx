import React from 'react';
import { RecentAttendanceCards } from '@/components/attendance/RecentAttendanceCards';
import { BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function StudentAttendanceSection() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-extrabold text-foreground flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-primary" /> Recent Lessons
        </p>
        <button onClick={() => navigate('/attendance')} className="text-[10px] text-primary font-bold hover:underline">
          View All →
        </button>
      </div>
      <RecentAttendanceCards role="student" limit={3} />
    </div>
  );
}
