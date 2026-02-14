import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Mail, Users, MoreHorizontal, Pencil, Trash2, Loader2, AlertCircle, ChevronDown, ChevronRight, User, Clock, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface StudentWithSchedule {
  id: string;
  full_name: string;
  gender: string | null;
  age: number | null;
  subject_name: string | null;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string | null;
  student_count: number;
  students?: StudentWithSchedule[];
  country: string | null;
  city: string | null;
}

type SortField = 'name' | 'email' | 'student_count' | 'country' | 'city';
type SortOrder = 'asc' | 'desc';

export default function Teachers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  
  // Sorting & Filtering
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');

  // Fetch teachers from Supabase with assigned students and schedules
  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers-list-full'],
    queryFn: async () => {
      // Get all users with teacher role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');

      if (roleError) throw roleError;

      const teacherIds = roleData?.map(r => r.user_id) || [];
      if (teacherIds.length === 0) return [];

      // Get profiles for those teachers with location
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, country, city')
        .in('id', teacherIds);

      if (profileError) throw profileError;

      // Get all student assignments with student details
      const { data: assignments, error: assignError } = await supabase
        .from('student_teacher_assignments')
        .select(`
          teacher_id,
          student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, gender, age),
          subject:subjects(name)
        `)
        .in('teacher_id', teacherIds)
        .in('status', ['active', 'paused']);

      if (assignError) throw assignError;

      // Group students by teacher
      const studentsByTeacher = new Map<string, StudentWithSchedule[]>();
      assignments?.forEach((a: any) => {
        const student = a.student as any;
        const subject = a.subject as any;
        if (!studentsByTeacher.has(a.teacher_id)) {
          studentsByTeacher.set(a.teacher_id, []);
        }
        studentsByTeacher.get(a.teacher_id)?.push({
          id: student.id,
          full_name: student.full_name,
          gender: student.gender,
          age: student.age,
          subject_name: subject?.name || null,
        });
      });

      return (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        student_count: studentsByTeacher.get(p.id)?.length || 0,
        students: studentsByTeacher.get(p.id) || [],
        country: p.country || null,
        city: p.city || null,
      })) as Teacher[];
    },
  });

  // Get unique countries and cities for filters
  const uniqueCountries = useMemo(() => {
    const countries = new Set(teachers.map(t => t.country).filter(Boolean) as string[]);
    return [...countries].sort();
  }, [teachers]);

  const uniqueCities = useMemo(() => {
    const cities = teachers
      .filter(t => !filterCountry || t.country === filterCountry)
      .map(t => t.city)
      .filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [teachers, filterCountry]);

  const filteredTeachers = useMemo(() => {
    let filtered = teachers.filter(teacher => {
      const matchesSearch = teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesCountry = !filterCountry || teacher.country === filterCountry;
      const matchesCity = !filterCity || teacher.city === filterCity;
      return matchesSearch && matchesCountry && matchesCity;
    });

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = (a.full_name || '').localeCompare(b.full_name || '');
          break;
        case 'email':
          cmp = (a.email || '').localeCompare(b.email || '');
          break;
        case 'student_count':
          cmp = a.student_count - b.student_count;
          break;
        case 'country':
          cmp = (a.country || '').localeCompare(b.country || '');
          break;
        case 'city':
          cmp = (a.city || '').localeCompare(b.city || '');
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [teachers, searchTerm, filterCountry, filterCity, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 text-primary" /> 
      : <ArrowDown className="h-4 w-4 ml-1 text-primary" />;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterCountry('');
    setFilterCity('');
    setSortField('name');
    setSortOrder('asc');
  };

  // Add teacher mutation
  const addMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          fullName: data.name,
          role: 'teacher',
          password: 'TempPassword123!',
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers-list-full'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      toast({ title: 'Success', description: 'Teacher added successfully' });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update teacher mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; email: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: data.name, email: data.email })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers-list-full'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      toast({ title: 'Success', description: 'Teacher updated successfully' });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete teacher mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers-list-full'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      toast({ title: 'Deleted', description: 'Teacher removed successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', email: '' });
    setEditingTeacher(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    if (editingTeacher) {
      updateMutation.mutate({ id: editingTeacher.id, ...formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({ name: teacher.full_name, email: teacher.email || '' });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this teacher?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleExpanded = (teacherId: string) => {
    setExpandedTeachers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teacherId)) {
        newSet.delete(teacherId);
      } else {
        newSet.add(teacherId);
      }
      return newSet;
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Teachers</h1>
            <p className="text-muted-foreground mt-1">Manage your academy's teachers</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="h-4 w-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">
                  {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter teacher's name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="teacher@quran.academy"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingTeacher ? 'Update' : 'Add'} Teacher
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterCountry || "all"} onValueChange={(v) => { setFilterCountry(v === 'all' ? '' : v); setFilterCity(''); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {uniqueCountries.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCity || "all"} onValueChange={(v) => setFilterCity(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {uniqueCities.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={resetFilters} title="Reset Filters">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No teachers found</p>
              <p className="text-sm mt-1">Add a teacher to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <span className="flex items-center">Name {getSortIcon('name')}</span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('email')}
                  >
                    <span className="flex items-center">Email {getSortIcon('email')}</span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('country')}
                  >
                    <span className="flex items-center">Country {getSortIcon('country')}</span>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('city')}
                  >
                    <span className="flex items-center">City {getSortIcon('city')}</span>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('student_count')}
                  >
                    <span className="flex items-center justify-center">Students {getSortIcon('student_count')}</span>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => (
                  <React.Fragment key={teacher.id}>
                    <TableRow 
                      className={cn(
                        "cursor-pointer transition-colors",
                        expandedTeachers.has(teacher.id) && "bg-muted/50"
                      )}
                      onClick={() => teacher.student_count > 0 && toggleExpanded(teacher.id)}
                    >
                      <TableCell>
                        {teacher.student_count > 0 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {expandedTeachers.has(teacher.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{teacher.full_name}</TableCell>
                      <TableCell>
                        {teacher.email ? (
                          <span className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {teacher.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">No email</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{teacher.country || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{teacher.city || '-'}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
                          <Users className="h-3 w-3" />
                          {teacher.student_count}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(teacher)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDelete(teacher.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {/* Expanded Students List with Schedule */}
                    {expandedTeachers.has(teacher.id) && teacher.students && teacher.students.length > 0 && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={5} className="p-0">
                          <div className="px-8 py-4 border-l-4 border-primary/30">
                            <p className="text-sm font-medium text-muted-foreground mb-3">Assigned Students:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {teacher.students.map((student) => (
                                <div 
                                  key={student.id}
                                  className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border"
                                >
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <User className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm">{student.full_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {student.age && `Age ${student.age}`}
                                      {student.age && student.gender && ' • '}
                                      {student.gender && <span className="capitalize">{student.gender}</span>}
                                    </p>
                                    {/* Subject */}
                                    {student.subject_name && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                        <BookOpen className="h-3 w-3" />
                                        {student.subject_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
