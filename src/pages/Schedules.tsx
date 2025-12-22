import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar, Clock, User, MoreHorizontal, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Assignment {
  id: string;
  teacher_id: string;
  student_id: string;
  teacher_name: string;
  student_name: string;
}

export default function Schedules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ assignmentId: '', day: '', time: '', duration: '30' });
  const { toast } = useToast();

  // Fetch assignments from student_teacher_assignments (single source of truth)
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['student-teacher-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          teacher_id,
          student_id,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          student:profiles!student_teacher_assignments_student_id_fkey(full_name)
        `);

      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        teacher_id: row.teacher_id,
        student_id: row.student_id,
        teacher_name: row.teacher?.full_name || 'Unknown',
        student_name: row.student?.full_name || 'Unknown',
      })) as Assignment[];
    },
  });

  const hasAssignments = assignments.length > 0;

  const handleAddSchedule = () => {
    if (!newSchedule.assignmentId || !newSchedule.day || !newSchedule.time) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    
    // Schedule functionality would save to a schedules table (not implemented yet)
    toast({ title: 'Info', description: 'Schedule table not yet implemented. Assignment exists in system.', variant: 'default' });
    setNewSchedule({ assignmentId: '', day: '', time: '', duration: '30' });
    setIsDialogOpen(false);
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
              <Button variant="hero" disabled={!hasAssignments}>
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
                  <Label>Student–Teacher Assignment *</Label>
                  <Select value={newSchedule.assignmentId} onValueChange={(value) => setNewSchedule({ ...newSchedule, assignmentId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments.map((assignment) => (
                        <SelectItem key={assignment.id} value={assignment.id}>
                          {assignment.student_name} → {assignment.teacher_name}
                        </SelectItem>
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

        {/* No Assignments Warning */}
        {!hasAssignments && !isLoading && (
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-accent" />
                <div>
                  <p className="font-medium text-foreground">No Student–Teacher Assignments</p>
                  <p className="text-sm text-muted-foreground">
                    Create assignments in the Assignments module before scheduling classes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule Table - Shows current assignments */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No schedules available</p>
              <p className="text-sm mt-1">Assignments must exist before creating schedules</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{assignment.student_name}</span>
                      </span>
                    </TableCell>
                    <TableCell>{assignment.teacher_name}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-light/10 text-emerald-light">
                        Assigned
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
