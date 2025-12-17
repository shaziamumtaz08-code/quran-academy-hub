import React, { useState } from 'react';
import { StatCard } from './StatCard';
import { TodayClasses } from './TodayClasses';
import { Users, Calendar, CheckCircle, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const mockStats = {
  assignedStudents: 8,
  classesToday: 6,
  classesThisMonth: 120,
  attendanceRate: 94,
};

type ClassStatus = 'pending' | 'present' | 'absent' | 'late';

interface ClassItem {
  id: string;
  studentName: string;
  time: string;
  duration: number;
  status: ClassStatus;
}

const initialClasses: ClassItem[] = [
  { id: '1', studentName: 'Muhammad Ali', time: '09:00 AM', duration: 30, status: 'present' },
  { id: '2', studentName: 'Sara Ahmed', time: '10:00 AM', duration: 45, status: 'pending' },
  { id: '3', studentName: 'Yusuf Khan', time: '11:30 AM', duration: 30, status: 'pending' },
  { id: '4', studentName: 'Fatima Hassan', time: '02:00 PM', duration: 30, status: 'pending' },
  { id: '5', studentName: 'Ibrahim Omar', time: '03:30 PM', duration: 30, status: 'pending' },
  { id: '6', studentName: 'Aisha Malik', time: '05:00 PM', duration: 45, status: 'pending' },
];

export function TeacherDashboard() {
  const [classes, setClasses] = useState(initialClasses);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [lessonCovered, setLessonCovered] = useState('');
  const [homework, setHomework] = useState('');
  const { toast } = useToast();

  const handleMarkAttendance = (classId: string, status: 'present' | 'absent' | 'late') => {
    setClasses(prev => prev.map(c => 
      c.id === classId ? { ...c, status } : c
    ));
    
    if (status === 'present' || status === 'late') {
      setSelectedClass(classId);
      setLessonDialogOpen(true);
    } else {
      toast({
        title: "Attendance Marked",
        description: `Student marked as ${status}`,
      });
    }
  };

  const handleSaveLesson = () => {
    toast({
      title: "Lesson Saved",
      description: "Attendance and lesson details have been recorded.",
    });
    setLessonDialogOpen(false);
    setLessonCovered('');
    setHomework('');
    setSelectedClass(null);
  };

  const classForDialog = classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">Welcome, Sheikh Ahmad</h1>
        <p className="text-muted-foreground mt-1">Here's your teaching schedule for today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Assigned Students"
          value={mockStats.assignedStudents}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Classes Today"
          value={mockStats.classesToday}
          icon={Calendar}
        />
        <StatCard
          title="Classes This Month"
          value={mockStats.classesThisMonth}
          icon={BookOpen}
        />
        <StatCard
          title="Attendance Rate"
          value={`${mockStats.attendanceRate}%`}
          icon={CheckCircle}
          variant="gold"
        />
      </div>

      {/* Today's Classes */}
      <TodayClasses 
        classes={classes} 
        onMarkAttendance={handleMarkAttendance}
        isTeacher={true}
      />

      {/* Monthly Summary */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-serif text-xl font-bold text-foreground mb-4">This Month's Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-2xl font-serif font-bold text-primary">120</p>
            <p className="text-sm text-muted-foreground">Total Classes</p>
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-emerald-light">113</p>
            <p className="text-sm text-muted-foreground">Attended</p>
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-accent">5</p>
            <p className="text-sm text-muted-foreground">Late</p>
          </div>
          <div>
            <p className="text-2xl font-serif font-bold text-destructive">2</p>
            <p className="text-sm text-muted-foreground">Absent</p>
          </div>
        </div>
      </div>

      {/* Lesson Entry Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Record Lesson Details</DialogTitle>
            <DialogDescription>
              {classForDialog && `Enter the lesson details for ${classForDialog.studentName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lesson">Lesson Covered</Label>
              <Input
                id="lesson"
                placeholder="e.g., Surah Al-Baqarah, Ayat 1-5"
                value={lessonCovered}
                onChange={(e) => setLessonCovered(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homework">Homework / Notes</Label>
              <Textarea
                id="homework"
                placeholder="Enter homework or notes for the student..."
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>
              Skip
            </Button>
            <Button onClick={handleSaveLesson}>
              Save Lesson
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
