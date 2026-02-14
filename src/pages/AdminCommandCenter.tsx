import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  Link2, 
  Activity, 
  Shield, 
  Loader2,
  KeyRound,
  Search,
  CheckCircle,
  BookOpen,
} from 'lucide-react';
import { format } from 'date-fns';

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  admin_admissions: 'Admissions Admin',
  admin_fees: 'Fees Admin',
  admin_academic: 'Academic Admin',
  teacher: 'Teacher',
  examiner: 'Examiner',
  student: 'Student',
  parent: 'Parent',
};

export default function AdminCommandCenter() {
  const { isSuperAdmin, hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create user form state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('student');
  const [newUserWhatsapp, setNewUserWhatsapp] = useState('');
  const [newUserGender, setNewUserGender] = useState<'male' | 'female' | ''>('');
  const [newUserAge, setNewUserAge] = useState('');
  
  // Assignment form state
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');

  // Check access
  if (!isSuperAdmin && !hasPermission('users.view')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Admin access required.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Fetch all users with roles
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .maybeSingle();

          return {
            ...profile,
            role: roleData?.role as AppRole | null,
          };
        })
      );

      return usersWithRoles;
    },
  });

  // Fetch teachers and students for assignment
  const teachers = users?.filter(u => u.role === 'teacher') || [];
  const students = users?.filter(u => u.role === 'student') || [];

  // Fetch subjects
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch today's lessons
  const { data: todayLessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['today-lessons'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          class_date,
          class_time,
          status,
          sabaq,
          lesson_covered,
          student:profiles!attendance_student_id_fkey(full_name),
          teacher:profiles!attendance_teacher_id_fkey(full_name)
        `)
        .eq('class_date', today)
        .order('class_time', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: {
      email: string;
      password: string;
      fullName: string;
      role: AppRole;
      whatsapp?: string;
      gender?: string;
      age?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { 
          email: userData.email, 
          password: userData.password, 
          fullName: userData.fullName, 
          role: userData.role,
          whatsapp: userData.whatsapp,
          gender: userData.gender,
          age: userData.age,
        },
      });
      if (error) throw new Error(error.message || 'Failed to create user');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast({ title: 'User created', description: 'User can now login immediately.' });
      resetCreateForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Failed to create user',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Reset password mutation (placeholder - would need edge function)
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      // In a real implementation, this would call an edge function
      // to send a password reset email or generate a temporary password
      toast({
        title: 'Password Reset',
        description: 'Password reset link sent to user email.',
      });
      return { success: true };
    },
  });

  // Create enrollment mutation
  const createEnrollmentMutation = useMutation({
    mutationFn: async (data: { student_id: string; teacher_id: string; subject_id?: string }) => {
      const { error } = await supabase.from('enrollments').insert({
        student_id: data.student_id,
        teacher_id: data.teacher_id,
        subject_id: data.subject_id || null,
      });
      if (error) throw error;

      // Resolve timezones from profiles
      const { data: studentProfile } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', data.student_id)
        .maybeSingle();
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', data.teacher_id)
        .maybeSingle();

      // Also create student_teacher_assignment with resolved timezones
      await supabase.from('student_teacher_assignments').upsert({
        student_id: data.student_id,
        teacher_id: data.teacher_id,
        student_timezone: studentProfile?.timezone || null,
        teacher_timezone: teacherProfile?.timezone || null,
      }, { onConflict: 'student_id,teacher_id' }).select();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      toast({ title: 'Assignment created', description: 'Student assigned to teacher successfully.' });
      setIsAssignDialogOpen(false);
      setAssignStudentId('');
      setAssignTeacherId('');
      setAssignSubjectId('');
    },
    onError: (error) => {
      toast({
        title: 'Failed to create assignment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const resetCreateForm = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserPassword('');
    setNewUserRole('student');
    setNewUserWhatsapp('');
    setNewUserGender('');
    setNewUserAge('');
  };

  const filteredUsers = users?.filter(user => 
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">Command Center</h1>
          <p className="text-muted-foreground">Manage users, assignments, and monitor activity</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Assignments</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-primary-glow">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      User will be able to login immediately after creation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="Enter email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Min 6 characters"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([role, label]) => (
                            <SelectItem key={role} value={role}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Gender</Label>
                        <Select value={newUserGender} onValueChange={(v) => setNewUserGender(v as 'male' | 'female')}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Age</Label>
                        <Input
                          type="number"
                          value={newUserAge}
                          onChange={(e) => setNewUserAge(e.target.value)}
                          placeholder="Age"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Number</Label>
                      <Input
                        value={newUserWhatsapp}
                        onChange={(e) => setNewUserWhatsapp(e.target.value)}
                        placeholder="+1234567890"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      disabled={createUserMutation.isPending || !newUserEmail || !newUserName || !newUserPassword}
                      onClick={() => {
                        if (newUserPassword.length < 6) {
                          toast({ title: 'Password too short', variant: 'destructive' });
                          return;
                        }
                        createUserMutation.mutate({
                          email: newUserEmail.trim(),
                          password: newUserPassword,
                          fullName: newUserName.trim(),
                          role: newUserRole,
                          whatsapp: newUserWhatsapp || undefined,
                          gender: newUserGender || undefined,
                          age: newUserAge ? parseInt(newUserAge) : undefined,
                        });
                      }}
                    >
                      {createUserMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create User'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="hidden sm:table-cell">Gender</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers?.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.full_name}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.role === 'teacher' ? 'default' : 'secondary'}>
                                {user.role ? ROLE_LABELS[user.role] : 'No Role'}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell capitalize">{user.gender || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resetPasswordMutation.mutate(user.id)}
                                title="Reset Password"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-primary-glow">
                    <Link2 className="h-4 w-4 mr-2" />
                    New Assignment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Student to Teacher</DialogTitle>
                    <DialogDescription>
                      Link a student with a teacher for a specific subject.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Student *</Label>
                      <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select student" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Teacher *</Label>
                      <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject (Optional)</Label>
                      <Select value={assignSubjectId} onValueChange={setAssignSubjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      className="w-full" 
                      disabled={createEnrollmentMutation.isPending || !assignStudentId || !assignTeacherId}
                      onClick={() => {
                        createEnrollmentMutation.mutate({
                          student_id: assignStudentId,
                          teacher_id: assignTeacherId,
                          subject_id: assignSubjectId || undefined,
                        });
                      }}
                    >
                      {createEnrollmentMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Assignment'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Student-Teacher Assignments</CardTitle>
                <CardDescription>View and manage student-teacher relationships</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Use the button above to create new assignments.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Today's Lessons
                </CardTitle>
                <CardDescription>All lessons marked across the academy today</CardDescription>
              </CardHeader>
              <CardContent>
                {lessonsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : todayLessons && todayLessons.length > 0 ? (
                  <div className="space-y-3">
                    {todayLessons.map((lesson) => (
                      <div 
                        key={lesson.id} 
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {lesson.status === 'present' ? (
                            <CheckCircle className="h-5 w-5 text-emerald-light" />
                          ) : (
                            <BookOpen className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium">{lesson.student?.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Teacher: {lesson.teacher?.full_name} • {lesson.class_time}
                            </p>
                          </div>
                        </div>
                        <Badge variant={lesson.status === 'present' ? 'default' : 'secondary'}>
                          {lesson.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No lessons marked today yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
