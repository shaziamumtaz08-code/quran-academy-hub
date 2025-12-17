import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar, Clock, User, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface Schedule {
  id: string;
  studentName: string;
  teacherName: string;
  day: string;
  time: string;
  duration: number;
  isActive: boolean;
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const mockSchedules: Schedule[] = [
  { id: '1', studentName: 'Muhammad Ali', teacherName: 'Sheikh Ahmad', day: 'Monday', time: '09:00', duration: 30, isActive: true },
  { id: '2', studentName: 'Muhammad Ali', teacherName: 'Sheikh Ahmad', day: 'Wednesday', time: '09:00', duration: 30, isActive: true },
  { id: '3', studentName: 'Sara Ahmed', teacherName: 'Sheikh Ahmad', day: 'Monday', time: '10:00', duration: 45, isActive: true },
  { id: '4', studentName: 'Yusuf Khan', teacherName: 'Ustadh Ibrahim', day: 'Tuesday', time: '11:30', duration: 30, isActive: true },
  { id: '5', studentName: 'Fatima Hassan', teacherName: 'Sheikh Muhammad', day: 'Thursday', time: '14:00', duration: 30, isActive: true },
];

const mockStudents = [
  { id: '1', name: 'Muhammad Ali' },
  { id: '2', name: 'Sara Ahmed' },
  { id: '3', name: 'Yusuf Khan' },
  { id: '4', name: 'Fatima Hassan' },
];

const mockTeachers = [
  { id: '1', name: 'Sheikh Ahmad' },
  { id: '2', name: 'Ustadh Ibrahim' },
  { id: '3', name: 'Sheikh Muhammad' },
  { id: '4', name: 'Ustadha Fatima' },
];

export default function Schedules() {
  const [schedules, setSchedules] = useState(mockSchedules);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ studentId: '', teacherId: '', day: '', time: '', duration: '30' });
  const { toast } = useToast();

  const handleAddSchedule = () => {
    if (!newSchedule.studentId || !newSchedule.teacherId || !newSchedule.day || !newSchedule.time) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    
    const student = mockStudents.find(s => s.id === newSchedule.studentId);
    const teacher = mockTeachers.find(t => t.id === newSchedule.teacherId);
    
    const schedule: Schedule = {
      id: Date.now().toString(),
      studentName: student?.name || '',
      teacherName: teacher?.name || '',
      day: newSchedule.day,
      time: newSchedule.time,
      duration: Number(newSchedule.duration),
      isActive: true,
    };
    
    setSchedules([...schedules, schedule]);
    setNewSchedule({ studentId: '', teacherId: '', day: '', time: '', duration: '30' });
    setIsDialogOpen(false);
    toast({ title: 'Success', description: 'Schedule added successfully' });
  };

  const handleDeleteSchedule = (id: string) => {
    setSchedules(schedules.filter(s => s.id !== id));
    toast({ title: 'Deleted', description: 'Schedule removed successfully' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Class Schedules</h1>
            <p className="text-muted-foreground mt-1">Manage class schedules for students</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="h-4 w-4" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Add New Schedule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Student *</Label>
                  <Select value={newSchedule.studentId} onValueChange={(value) => setNewSchedule({ ...newSchedule, studentId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Teacher *</Label>
                  <Select value={newSchedule.teacherId} onValueChange={(value) => setNewSchedule({ ...newSchedule, teacherId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Day *</Label>
                  <Select value={newSchedule.day} onValueChange={(value) => setNewSchedule({ ...newSchedule, day: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="time">Time *</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newSchedule.time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (min)</Label>
                    <Select value={newSchedule.duration} onValueChange={(value) => setNewSchedule({ ...newSchedule, duration: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSchedule}>Add Schedule</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Schedule Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-center">Duration</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{schedule.studentName}</span>
                    </span>
                  </TableCell>
                  <TableCell>{schedule.teacherName}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      {schedule.day}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {schedule.time}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{schedule.duration} min</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      schedule.isActive 
                        ? 'bg-emerald-light/10 text-emerald-light' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {schedule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
