import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  date: string;
  studentName: string;
  teacherName: string;
  time: string;
  status: 'present' | 'absent' | 'late';
  lessonCovered?: string;
}

const mockAttendance: AttendanceRecord[] = [
  { id: '1', date: '2024-12-17', studentName: 'Muhammad Ali', teacherName: 'Sheikh Ahmad', time: '09:00 AM', status: 'present', lessonCovered: 'Surah Al-Baqarah, Ayat 1-5' },
  { id: '2', date: '2024-12-17', studentName: 'Sara Ahmed', teacherName: 'Sheikh Ahmad', time: '10:00 AM', status: 'present', lessonCovered: 'Tajweed - Noon Sakinah' },
  { id: '3', date: '2024-12-17', studentName: 'Yusuf Khan', teacherName: 'Ustadh Ibrahim', time: '11:30 AM', status: 'late', lessonCovered: 'Surah Al-Imran, Ayat 1-3' },
  { id: '4', date: '2024-12-16', studentName: 'Muhammad Ali', teacherName: 'Sheikh Ahmad', time: '09:00 AM', status: 'present', lessonCovered: 'Surah Al-Fatiha Revision' },
  { id: '5', date: '2024-12-16', studentName: 'Fatima Hassan', teacherName: 'Sheikh Muhammad', time: '02:00 PM', status: 'absent' },
  { id: '6', date: '2024-12-15', studentName: 'Sara Ahmed', teacherName: 'Sheikh Ahmad', time: '10:00 AM', status: 'present', lessonCovered: 'Makharij - Points of Articulation' },
];

export default function Attendance() {
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('week');

  const filteredAttendance = mockAttendance.filter(record => {
    if (filter !== 'all' && record.status !== filter) return false;
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-emerald-light" />;
      case 'absent':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'late':
        return <AlertCircle className="h-4 w-4 text-accent" />;
    }
  };

  const stats = {
    total: mockAttendance.length,
    present: mockAttendance.filter(r => r.status === 'present').length,
    absent: mockAttendance.filter(r => r.status === 'absent').length,
    late: mockAttendance.filter(r => r.status === 'late').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Attendance Records</h1>
          <p className="text-muted-foreground mt-1">View and manage class attendance</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-serif font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Classes</p>
          </div>
          <div className="bg-emerald-light/10 rounded-xl border border-emerald-light/20 p-4 text-center">
            <p className="text-2xl font-serif font-bold text-emerald-light">{stats.present}</p>
            <p className="text-sm text-emerald-light/80">Present</p>
          </div>
          <div className="bg-accent/10 rounded-xl border border-accent/20 p-4 text-center">
            <p className="text-2xl font-serif font-bold text-accent">{stats.late}</p>
            <p className="text-sm text-accent/80">Late</p>
          </div>
          <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-4 text-center">
            <p className="text-2xl font-serif font-bold text-destructive">{stats.absent}</p>
            <p className="text-sm text-destructive/80">Absent</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="late">Late</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lesson Covered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttendance.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {record.date}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{record.studentName}</span>
                    </span>
                  </TableCell>
                  <TableCell>{record.teacherName}</TableCell>
                  <TableCell>{record.time}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize",
                      record.status === 'present' && "bg-emerald-light/10 text-emerald-light",
                      record.status === 'absent' && "bg-destructive/10 text-destructive",
                      record.status === 'late' && "bg-accent/10 text-accent"
                    )}>
                      {getStatusIcon(record.status)}
                      {record.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {record.lessonCovered || '-'}
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
