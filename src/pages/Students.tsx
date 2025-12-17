import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Mail, User, DollarSign, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  name: string;
  email: string;
  parentName: string;
  teacherName: string;
  monthlyFee: number;
  feeStatus: 'paid' | 'unpaid';
}

const mockStudents: Student[] = [
  { id: '1', name: 'Muhammad Ali', email: 'mali@email.com', parentName: 'Ahmed Hassan', teacherName: 'Sheikh Ahmad', monthlyFee: 100, feeStatus: 'paid' },
  { id: '2', name: 'Sara Ahmed', email: 'sara@email.com', parentName: 'Omar Ahmed', teacherName: 'Sheikh Ahmad', monthlyFee: 120, feeStatus: 'paid' },
  { id: '3', name: 'Yusuf Khan', email: 'yusuf@email.com', parentName: 'Rashid Khan', teacherName: 'Ustadh Ibrahim', monthlyFee: 100, feeStatus: 'unpaid' },
  { id: '4', name: 'Fatima Hassan', email: 'fatima@email.com', parentName: 'Hassan Ali', teacherName: 'Sheikh Muhammad', monthlyFee: 150, feeStatus: 'paid' },
  { id: '5', name: 'Ibrahim Omar', email: 'ibrahim@email.com', parentName: 'Omar Malik', teacherName: 'Ustadha Fatima', monthlyFee: 100, feeStatus: 'unpaid' },
];

const mockTeachers = [
  { id: '1', name: 'Sheikh Ahmad' },
  { id: '2', name: 'Ustadh Ibrahim' },
  { id: '3', name: 'Sheikh Muhammad' },
  { id: '4', name: 'Ustadha Fatima' },
];

export default function Students() {
  const [students, setStudents] = useState(mockStudents);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', parentName: '', teacherId: '', monthlyFee: '' });
  const { toast } = useToast();

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddStudent = () => {
    if (!newStudent.name || !newStudent.email) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    
    const teacher = mockTeachers.find(t => t.id === newStudent.teacherId);
    const student: Student = {
      id: Date.now().toString(),
      name: newStudent.name,
      email: newStudent.email,
      parentName: newStudent.parentName,
      teacherName: teacher?.name || 'Unassigned',
      monthlyFee: Number(newStudent.monthlyFee) || 100,
      feeStatus: 'unpaid',
    };
    
    setStudents([...students, student]);
    setNewStudent({ name: '', email: '', parentName: '', teacherId: '', monthlyFee: '' });
    setIsDialogOpen(false);
    toast({ title: 'Success', description: 'Student added successfully' });
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
    toast({ title: 'Deleted', description: 'Student removed successfully' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Students</h1>
            <p className="text-muted-foreground mt-1">Manage your academy's students</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Add New Student</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Student Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter student's name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@email.com"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent">Parent Name</Label>
                  <Input
                    id="parent"
                    placeholder="Enter parent's name"
                    value={newStudent.parentName}
                    onChange={(e) => setNewStudent({ ...newStudent, parentName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher">Assign Teacher</Label>
                  <Select value={newStudent.teacherId} onValueChange={(value) => setNewStudent({ ...newStudent, teacherId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee">Monthly Fee ($)</Label>
                  <Input
                    id="fee"
                    type="number"
                    placeholder="100"
                    value={newStudent.monthlyFee}
                    onChange={(e) => setNewStudent({ ...newStudent, monthlyFee: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddStudent}>Add Student</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="text-right">Monthly Fee</TableHead>
                <TableHead className="text-center">Fee Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{student.name}</span>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {student.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {student.parentName}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{student.teacherName}</TableCell>
                  <TableCell className="text-right font-medium">${student.monthlyFee}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      student.feeStatus === 'paid' 
                        ? 'bg-emerald-light/10 text-emerald-light' 
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {student.feeStatus === 'paid' ? 'Paid' : 'Unpaid'}
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
                          onClick={() => handleDeleteStudent(student.id)}
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
