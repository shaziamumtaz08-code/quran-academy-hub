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
import { Checkbox } from '@/components/ui/checkbox';
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

export default function UserManagement() {
  const { isSuperAdmin, hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('student');

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
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .single();

          const { data: exceptions } = await supabase
            .from('permission_exceptions')
            .select('*')
            .eq('user_id', profile.id);

          return {
            ...profile,
            role: roleData?.role || null,
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
        // Remove exception
        const { error } = await supabase
          .from('permission_exceptions')
          .delete()
          .eq('user_id', userId)
          .eq('permission', permission);
        if (error) throw error;
      } else {
        // Upsert exception
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

  const getEffectivePermission = (user: any, permission: string): boolean | 'inherited' => {
    const exception = user.exceptions?.find((e: any) => e.permission === permission);
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
                    Add a new user to the system. They will receive login credentials.
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
                      placeholder="Enter password"
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
                  <Button 
                    className="w-full" 
                    onClick={async () => {
                      // This would need admin API to create users
                      toast({
                        title: 'Feature coming soon',
                        description: 'User creation via admin panel requires additional setup.',
                      });
                      setIsCreateDialogOpen(false);
                    }}
                  >
                    Create User
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
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
                                value={user.role || ''}
                                onValueChange={(role) => {
                                  updateRoleMutation.mutate({ userId: user.id, role: role as AppRole });
                                }}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                    <SelectItem key={role} value={role}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary">
                                {user.role ? ROLE_LABELS[user.role as AppRole] : 'No role'}
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
                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
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
                        {(template.permissions || []).slice(0, 5).map((perm) => (
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
                    {selectedUser.role ? ROLE_LABELS[selectedUser.role as AppRole] : 'No role'}
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
                                <CheckCircle2 className="h-4 w-4 text-success" />
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
      </div>
    </DashboardLayout>
  );
}