import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Calendar, User, FileText } from 'lucide-react';

interface Lesson {
  id: string;
  date: string;
  studentName: string;
  teacherName: string;
  lessonCovered: string;
  homework: string;
  notes?: string;
}

const mockLessons: Lesson[] = [
  { id: '1', date: '2024-12-17', studentName: 'Muhammad Ali', teacherName: 'Sheikh Ahmad', lessonCovered: 'Surah Al-Baqarah, Ayat 1-5', homework: 'Memorize Ayat 1-3', notes: 'Excellent progress' },
  { id: '2', date: '2024-12-17', studentName: 'Sara Ahmed', teacherName: 'Sheikh Ahmad', lessonCovered: 'Tajweed - Noon Sakinah', homework: 'Practice exercises on page 15', notes: 'Needs more practice' },
  { id: '3', date: '2024-12-17', studentName: 'Yusuf Khan', teacherName: 'Ustadh Ibrahim', lessonCovered: 'Surah Al-Imran, Ayat 1-3', homework: 'Revise pronunciation', notes: '' },
  { id: '4', date: '2024-12-16', studentName: 'Muhammad Ali', teacherName: 'Sheikh Ahmad', lessonCovered: 'Surah Al-Fatiha (Revision)', homework: 'Perfect Tajweed rules', notes: 'Very good recitation' },
  { id: '5', date: '2024-12-16', studentName: 'Fatima Hassan', teacherName: 'Sheikh Muhammad', lessonCovered: 'Basic Arabic Letters', homework: 'Write letters 5 times each', notes: 'Starting from basics' },
  { id: '6', date: '2024-12-15', studentName: 'Sara Ahmed', teacherName: 'Sheikh Ahmad', lessonCovered: 'Makharij - Points of Articulation', homework: 'Practice mouth positions', notes: '' },
];

export default function Lessons() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Lessons</h1>
          <p className="text-muted-foreground mt-1">View all lesson records and homework assignments</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-primary/5 rounded-xl border border-primary/20 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Lessons</p>
                <p className="text-2xl font-serif font-bold text-foreground">{mockLessons.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-accent/5 rounded-xl border border-accent/20 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Homework Assigned</p>
                <p className="text-2xl font-serif font-bold text-foreground">{mockLessons.filter(l => l.homework).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-teal/5 rounded-xl border border-teal/20 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-teal/10 flex items-center justify-center">
                <User className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Students Active</p>
                <p className="text-2xl font-serif font-bold text-foreground">{new Set(mockLessons.map(l => l.studentName)).size}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Lesson Covered</TableHead>
                <TableHead>Homework</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLessons.map((lesson) => (
                <TableRow key={lesson.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {lesson.date}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{lesson.studentName}</TableCell>
                  <TableCell>{lesson.teacherName}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      {lesson.lessonCovered}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{lesson.homework}</TableCell>
                  <TableCell className="text-muted-foreground">{lesson.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
