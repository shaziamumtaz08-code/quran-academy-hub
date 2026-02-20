import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { BookOpen, Calendar, User, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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

type SortField = 'date' | 'student' | 'teacher';
type SortOrder = 'asc' | 'desc';

export default function Lessons() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const uniqueTeachers = useMemo(() => {
    return [...new Set(mockLessons.map(l => l.teacherName))].sort();
  }, []);

  const teacherFilterOptions = useMemo(() => [
    { value: 'all', label: 'All Teachers' },
    ...uniqueTeachers.map(t => ({ value: t, label: t })),
  ], [uniqueTeachers]);

  const filteredLessons = useMemo(() => {
    let result = mockLessons.filter(lesson => {
      const matchesSearch = !searchTerm ||
        lesson.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lesson.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lesson.lessonCovered.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTeacher = filterTeacher === 'all' || lesson.teacherName === filterTeacher;
      return matchesSearch && matchesTeacher;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'student': cmp = a.studentName.localeCompare(b.studentName); break;
        case 'teacher': cmp = a.teacherName.localeCompare(b.teacherName); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [searchTerm, filterTeacher, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const handleReset = () => {
    setSearchTerm('');
    setFilterTeacher('all');
    setSortField('date');
    setSortOrder('desc');
  };

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

        {/* Toolbar */}
        <TableToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search lessons..."
          filterValue={filterTeacher}
          onFilterChange={setFilterTeacher}
          filterOptions={teacherFilterOptions}
          filterLabel="Teacher"
          onReset={handleReset}
        />

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('date')}>
                  <div className="flex items-center">Date {getSortIcon('date')}</div>
                </TableHead>
                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('student')}>
                  <div className="flex items-center">Student {getSortIcon('student')}</div>
                </TableHead>
                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('teacher')}>
                  <div className="flex items-center">Teacher {getSortIcon('teacher')}</div>
                </TableHead>
                <TableHead>Lesson Covered</TableHead>
                <TableHead>Homework</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLessons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No lessons found</TableCell>
                </TableRow>
              ) : (
                filteredLessons.map((lesson) => (
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
