import React from 'react';
import { StatCard } from './StatCard';
import { Calendar, CheckCircle, BookOpen, DollarSign, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const mockData = {
  teacher: 'Sheikh Ahmad',
  totalClasses: 24,
  attended: 22,
  lessonsCompleted: 15,
  feeStatus: 'paid' as const,
  monthlyFee: 100,
  schedule: [
    { day: 'Monday', time: '09:00 AM', duration: 30 },
    { day: 'Wednesday', time: '09:00 AM', duration: 30 },
    { day: 'Friday', time: '09:00 AM', duration: 30 },
  ],
  recentLessons: [
    { date: 'Dec 15', lesson: 'Surah Al-Baqarah, Ayat 1-5', homework: 'Memorize Ayat 1-3' },
    { date: 'Dec 13', lesson: 'Surah Al-Fatiha (Revision)', homework: 'Practice Tajweed rules' },
    { date: 'Dec 11', lesson: 'Basic Tajweed - Noon Sakinah', homework: 'Read pages 10-12' },
  ],
};

export function StudentDashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">Welcome, Muhammad Ali</h1>
        <p className="text-muted-foreground mt-1">Track your Quran learning progress</p>
      </div>

      {/* Teacher Info */}
      <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Teacher</p>
            <p className="text-xl font-serif font-bold text-foreground">{mockData.teacher}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="This Month's Classes"
          value={mockData.totalClasses}
          icon={Calendar}
        />
        <StatCard
          title="Attended"
          value={mockData.attended}
          icon={CheckCircle}
          variant="primary"
        />
        <StatCard
          title="Lessons Completed"
          value={mockData.lessonsCompleted}
          icon={BookOpen}
        />
        <StatCard
          title="Fee Status"
          value={mockData.feeStatus === 'paid' ? 'Paid' : 'Due'}
          icon={DollarSign}
          variant={mockData.feeStatus === 'paid' ? 'gold' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-serif text-xl font-bold text-foreground">Your Schedule</h3>
          </div>
          <div className="divide-y divide-border">
            {mockData.schedule.map((slot, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{slot.day}</p>
                    <p className="text-sm text-muted-foreground">{slot.time}</p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{slot.duration} min</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Lessons */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-serif text-xl font-bold text-foreground">Recent Lessons</h3>
          </div>
          <div className="divide-y divide-border">
            {mockData.recentLessons.map((lesson, idx) => (
              <div key={idx} className="p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{lesson.lesson}</p>
                    <p className="text-sm text-muted-foreground mt-1">📝 {lesson.homework}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{lesson.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-serif text-xl font-bold text-foreground mb-4">Attendance Summary</h3>
        <div className="flex items-center gap-8">
          <div className="flex-1">
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(mockData.attended / mockData.totalClasses) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-muted-foreground">Attendance Rate</span>
              <span className="font-medium text-foreground">
                {Math.round((mockData.attended / mockData.totalClasses) * 100)}%
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-serif font-bold text-primary">{mockData.attended}</p>
            <p className="text-sm text-muted-foreground">of {mockData.totalClasses} classes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
