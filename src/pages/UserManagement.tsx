import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Settings, 
  Search,
  Edit,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Phone,
  Mail,
  Calendar,
  User,
} from 'lucide-react';

const ALL_PERMISSIONS = [
  { group: 'Users', permissions: ['users.view', 'users.create', 'users.edit', 'users.delete', 'users.assign_roles'] },
  { group: 'Students', permissions: ['students.view', 'students.create', 'students.edit', 'students.delete'] },
  { group: 'Teachers', permissions: ['teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete'] },
  { group: 'Exams', permissions: ['exams.view', 'exams.create', 'exams.edit', 'exams.delete', 'exams.grade'] },
  { group: 'Attendance', permissions: ['attendance.view', 'attendance.mark', 'attendance.edit'] },
  { group: 'Schedules', permissions: ['schedules.view', 'schedules.create', 'schedules.edit', 'schedules.delete'] },
  { group: 'Reports', permissions: ['reports.view', 'reports.generate'] },
  { group: 'Payments', permissions: ['payments.view', 'payments.create', 'payments.edit'] },
  { group: 'Settings', permissions: ['settings.view', 'settings.edit'] },
  { group: 'Dashboard', permissions: ['dashboard.admin', 'dashboard.teacher', 'dashboard.student', 'dashboard.parent'] },
];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Administrator',
  admin: 'Administrator',
  admin_admissions: 'Admissions Admin',
  admin_fees: 'Fees Admin',
  admin_academic: 'Academic Admin',
  teacher: 'Teacher',
  examiner: 'Examiner',
  student: 'Student',
  parent: 'Parent',
};

interface UserWithRole {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_number: string | null;
  gender: string | null;
  age: number | null;
  created_at: string;
  role: AppRole | null;
  exceptions: Array<{ permission: string; is_granted: boolean }>;
}

export default function UserManagement() {
  const { isSuperAdmin, hasPermission, user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserWithRole | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserWithRole | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('student');
  const [newUserWhatsapp, setNewUserWhatsapp] = useState('');
  const [newUserGender, setNewUserGender] = useState<'male' | 'female' | ''>('');
  const [newUserAge, setNewUserAge] = useState('');

  // Check access
  if (!isSuperAdmin && !hasPermission('users.view')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access user management.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Fetch users with profiles and roles
  const { data: users, isLoading: usersLoading, error: usersError, refetch } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles for each user
      const usersWithRoles: UserWithRole[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .maybeSingle();

          const { data: exceptions } = await supabase
            .from('permission_exceptions')
            .select('permission, is_granted')
            .eq('user_id', profile.id);

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            whatsapp_number: profile.whatsapp_number,
            gender: profile.gender,
            age: profile.age,
            created_at: profile.created_at,
            role: (roleData?.role as AppRole) || null,
            exceptions: exceptions || [],
          };
        })
      );

      return usersWithRoles;
    },
  });

  // Fetch role templates
  const { data: roleTemplates } = useQuery({
    queryKey: ['role-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // First, delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Then insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Role updated',
        description: 'User role has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      });
    },
  });

  // Update permission exception mutation
  const updateExceptionMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      permission, 
      isGranted 
    }: { 
      userId: string; 
      permission: string; 
      isGranted: boolean | null;
    }) => {
      if (isGranted === null) {
        const { error } = await supabase
          .from('permission_exceptions')
          .delete()
          .eq('user_id', userId)
          .eq('permission', permission);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('permission_exceptions')
          .upsert({
            user_id: userId,
            permission,
            is_granted: isGranted,
          }, {
            onConflict: 'user_id,permission',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Permission updated',
        description: 'Permission exception has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update permission',
        variant: 'destructive',
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      fullName,
      role,
      whatsapp,
      gender,
      age,
    }: {
      email: string;
      password: string;
      fullName: string;
      role: AppRole;
      whatsapp?: string;
      gender?: 'male' | 'female';
      age?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email, password, fullName, role, whatsapp, gender, age },
      });
      if (error) throw new Error(error.message || 'Failed to create user');
      if (data?.error) throw new Error(data.error);
      return data as { userId: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'User created',
        description: 'New user was created successfully.',
      });
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('student');
      setNewUserWhatsapp('');
      setNewUserGender('');
      setNewUserAge('');
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

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      });
      if (error) throw new Error(error.message || 'Failed to delete user');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'User deleted',
        description: 'User was deleted successfully.',
      });
      setDeleteConfirmUser(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete user',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const filteredUsers = users?.filter(user => 
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleTemplate = (role: AppRole | null) => {
    return roleTemplates?.find(t => t.role === role);
  };

  const hasRolePermission = (role: AppRole | null, permission: string) => {
    const template = getRoleTemplate(role);
    return template?.permissions?.includes(permission) || false;
  };

  const getEffectivePermission = (user: UserWithRole, permission: string): boolean | 'inherited' => {
    const exception = user.exceptions?.find((e) => e.permission === permission);
    if (exception) {
      return exception.is_granted;
    }
    return 'inherited';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">Manage users, roles, and permissions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isSuperAdmin && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-primary-glow">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new user to the system. They will be able to login immediately.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Enter password (min 6 characters)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
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
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={newUserGender} onValueChange={(v) => setNewUserGender(v as 'male' | 'female' | '')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        min="1"
                        max="120"
                        value={newUserAge}
                        onChange={(e) => setNewUserAge(e.target.value)}
                        placeholder="Enter age"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp Number</Label>
                      <Input
                        id="whatsapp"
                        value={newUserWhatsapp}
                        onChange={(e) => setNewUserWhatsapp(e.target.value)}
                        placeholder="e.g. +1234567890"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      disabled={createUserMutation.isPending}
                      onClick={() => {
                        const email = newUserEmail.trim();
                        const fullName = newUserName.trim();
                        const password = newUserPassword;

                        if (!fullName || !email || !password) {
                          toast({
                            title: 'Missing fields',
                            description: 'Please enter name, email, and password.',
                            variant: 'destructive',
                          });
                          return;
                        }

                        if (password.length < 6) {
                          toast({
                            title: 'Password too short',
                            description: 'Password must be at least 6 characters.',
                            variant: 'destructive',
                          });
                          return;
                        }

                        createUserMutation.mutate({
                          email,
                          password,
                          fullName,
                          role: newUserRole,
                          whatsapp: newUserWhatsapp.trim() || undefined,
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
            )}
          </div>
        </div>

        {/* Error state */}
        {usersError && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>Failed to load users: {usersError instanceof Error ? usersError.message : 'Unknown error'}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users ({filteredUsers?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Role Templates
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Users Table */}
            <Card>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !filteredUsers?.length ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Exceptions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {isSuperAdmin ? (
                              <Select
                                value={user.role || "unassigned"}
                                onValueChange={(role) => {
                                  if (role !== "unassigned") {
                                    updateRoleMutation.mutate({ userId: user.id, role: role as AppRole });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-44">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned" disabled>No role assigned</SelectItem>
                                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                    <SelectItem key={role} value={role}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary">
                                {user.role ? ROLE_LABELS[user.role] : 'No role'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.exceptions?.length > 0 ? (
                              <Badge variant="outline" className="gap-1">
                                <Settings className="h-3 w-3" />
                                {user.exceptions.length} override{user.exceptions.length > 1 ? 's' : ''}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setViewingUser(user);
                                  setIsViewDialogOpen(true);
                                }}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isSuperAdmin && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setIsEditDialogOpen(true);
                                    }}
                                    title="Edit permissions"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {user.id !== currentUser?.id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteConfirmUser(user)}
                                      className="text-destructive hover:text-destructive"
                                      title="Delete user"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Role Templates Tab */}
          <TabsContent value="roles" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roleTemplates?.map((template) => (
                <Card key={template.id} className="card-interactive">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.is_system && (
                        <Badge variant="outline" className="text-xs">System</Badge>
                      )}
                    </div>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Permissions:</p>
                      <div className="flex flex-wrap gap-1">
                        {(template.permissions || []).slice(0, 5).map((perm: string) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                        {(template.permissions?.length || 0) > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{(template.permissions?.length || 0) - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit User Permissions Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Permissions: {selectedUser?.full_name}</DialogTitle>
              <DialogDescription>
                Configure permission exceptions for this user. Overrides take precedence over role defaults.
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
                  <div>
                    <p className="font-medium">{selectedUser.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                  <Badge className="ml-auto">
                    {selectedUser.role ? ROLE_LABELS[selectedUser.role] : 'No role'}
                  </Badge>
                </div>

                {ALL_PERMISSIONS.map((group) => (
                  <div key={group.group} className="space-y-3">
                    <h4 className="font-medium text-foreground">{group.group}</h4>
                    <div className="grid gap-2">
                      {group.permissions.map((permission) => {
                        const roleHasIt = hasRolePermission(selectedUser.role, permission);
                        const effective = getEffectivePermission(selectedUser, permission);
                        const isOverridden = effective !== 'inherited';
                        const finalValue = effective === 'inherited' ? roleHasIt : effective;

                        return (
                          <div 
                            key={permission} 
                            className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono">{permission}</span>
                              {roleHasIt && !isOverridden && (
                                <Badge variant="outline" className="text-xs">From role</Badge>
                              )}
                              {isOverridden && (
                                <Badge variant="secondary" className="text-xs">Override</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {finalValue ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <Select
                                value={
                                  effective === 'inherited' 
                                    ? 'inherited' 
                                    : effective ? 'granted' : 'denied'
                                }
                                onValueChange={(value) => {
                                  const isGranted = value === 'inherited' 
                                    ? null 
                                    : value === 'granted';
                                  updateExceptionMutation.mutate({
                                    userId: selectedUser.id,
                                    permission,
                                    isGranted,
                                  });
                                }}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherited">Inherited</SelectItem>
                                  <SelectItem value="granted">Granted</SelectItem>
                                  <SelectItem value="denied">Denied</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View User Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
            </DialogHeader>
            {viewingUser && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{viewingUser.full_name}</p>
                    <Badge variant="outline">
                      {viewingUser.role ? ROLE_LABELS[viewingUser.role] : 'No role'}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{viewingUser.email || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      <p className="text-sm font-medium">{viewingUser.whatsapp_number || '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Gender</p>
                        <p className="text-sm font-medium capitalize">{viewingUser.gender || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Age</p>
                        <p className="text-sm font-medium">{viewingUser.age || '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm font-medium">
                        {new Date(viewingUser.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmUser} onOpenChange={() => setDeleteConfirmUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteConfirmUser?.full_name}</strong>? 
                This action cannot be undone and will remove all their data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteConfirmUser) {
                    deleteUserMutation.mutate(deleteConfirmUser.id);
                  }
                }}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
