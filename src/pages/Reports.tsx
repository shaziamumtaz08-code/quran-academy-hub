import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, User, Calendar, TrendingUp, BookOpen } from 'lucide-react';

interface MonthlyReport {
  id: string;
  studentName: string;
  teacherName: string;
  month: string;
  totalClasses: number;
  attendedClasses: number;
  lessonsCompleted: number;
  progressNotes: string;
}

const mockReports: MonthlyReport[] = [
  { id: '1', studentName: 'Muhammad Ali', teacherName: 'Sheikh Ahmad', month: 'December 2024', totalClasses: 24, attendedClasses: 22, lessonsCompleted: 15, progressNotes: 'Excellent progress in memorization. Completed Surah Al-Baqarah Ayat 1-20. Tajweed has improved significantly.' },
  { id: '2', studentName: 'Sara Ahmed', teacherName: 'Sheikh Ahmad', month: 'December 2024', totalClasses: 24, attendedClasses: 23, lessonsCompleted: 18, progressNotes: 'Outstanding dedication. Mastered Makharij and basic Tajweed rules. Ready to move to advanced lessons.' },
  { id: '3', studentName: 'Yusuf Khan', teacherName: 'Ustadh Ibrahim', month: 'December 2024', totalClasses: 20, attendedClasses: 16, lessonsCompleted: 10, progressNotes: 'Good progress but attendance needs improvement. Focus on regular practice at home.' },
  { id: '4', studentName: 'Fatima Hassan', teacherName: 'Sheikh Muhammad', month: 'December 2024', totalClasses: 20, attendedClasses: 19, lessonsCompleted: 12, progressNotes: 'Very attentive student. Making steady progress in reading and pronunciation.' },
];

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = React.useState('december-2024');

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Monthly Reports</h1>
            <p className="text-muted-foreground mt-1">View student progress and performance reports</p>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="december-2024">December 2024</SelectItem>
              <SelectItem value="november-2024">November 2024</SelectItem>
              <SelectItem value="october-2024">October 2024</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mockReports.map((report) => {
            const attendanceRate = Math.round((report.attendedClasses / report.totalClasses) * 100);
            
            return (
              <div key={report.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-soft transition-shadow">
                {/* Header */}
                <div className="bg-primary/5 p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-serif text-lg font-bold text-foreground">{report.studentName}</h3>
                        <p className="text-sm text-muted-foreground">Teacher: {report.teacherName}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {report.month}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-serif font-bold text-primary">{attendanceRate}%</p>
                      <p className="text-xs text-muted-foreground">Attendance</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-serif font-bold text-foreground">{report.attendedClasses}/{report.totalClasses}</p>
                      <p className="text-xs text-muted-foreground">Classes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-serif font-bold text-accent">{report.lessonsCompleted}</p>
                      <p className="text-xs text-muted-foreground">Lessons</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Attendance Rate</span>
                      <span className="text-sm font-medium text-foreground">{attendanceRate}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Progress Notes */}
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Teacher's Notes</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{report.progressNotes}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
