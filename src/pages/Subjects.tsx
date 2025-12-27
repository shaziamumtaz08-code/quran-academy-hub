import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Plus, Pencil, Trash2, Loader2, Shield } from 'lucide-react';

export default function Subjects() {
  const { isSuperAdmin, hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; description: string; is_active: boolean } | null>(null);
  
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Check access
  if (!isSuperAdmin && !hasPermission('settings.edit')) {
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

  // Fetch subjects
  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Create subject mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const { error } = await supabase.from('subjects').insert({
        name: data.name,
        description: data.description || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects-all'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({ title: 'Subject created successfully' });
      setIsCreateDialogOpen(false);
      setNewName('');
      setNewDescription('');
    },
    onError: (error) => {
      toast({
        title: 'Failed to create subject',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Update subject mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string; is_active: boolean }) => {
      const { error } = await supabase.from('subjects').update({
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
      }).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects-all'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({ title: 'Subject updated successfully' });
      setIsEditDialogOpen(false);
      setEditingSubject(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to update subject',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Delete subject mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects-all'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({ title: 'Subject deleted successfully' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete subject',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (subject: typeof editingSubject) => {
    setEditingSubject(subject);
    setIsEditDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">Subject Management</h1>
            <p className="text-muted-foreground">Manage courses and subjects for your academy</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary-glow">
                <Plus className="h-4 w-4 mr-2" />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Subject</DialogTitle>
                <DialogDescription>Add a new subject or course to your academy.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Subject Name *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Nazra, Hifz, Tajweed"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of the subject"
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={createMutation.isPending || !newName.trim()}
                  onClick={() => createMutation.mutate({ name: newName.trim(), description: newDescription.trim() })}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Subject'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Subjects Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              All Subjects
            </CardTitle>
            <CardDescription>View and manage all subjects in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : subjects && subjects.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjects.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="font-medium">{subject.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {subject.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={subject.is_active ? 'default' : 'secondary'}>
                            {subject.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit({
                                id: subject.id,
                                name: subject.name,
                                description: subject.description || '',
                                is_active: subject.is_active,
                              })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this subject?')) {
                                  deleteMutation.mutate(subject.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No subjects found</p>
                <p className="text-sm">Click "Add Subject" to create your first subject</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Subject</DialogTitle>
              <DialogDescription>Update subject details.</DialogDescription>
            </DialogHeader>
            {editingSubject && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Subject Name *</Label>
                  <Input
                    value={editingSubject.name}
                    onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingSubject.description}
                    onChange={(e) => setEditingSubject({ ...editingSubject, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="font-medium">Active</Label>
                    <p className="text-sm text-muted-foreground">Subject is available for enrollment</p>
                  </div>
                  <Switch
                    checked={editingSubject.is_active}
                    onCheckedChange={(checked) => setEditingSubject({ ...editingSubject, is_active: checked })}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={updateMutation.isPending || !editingSubject.name.trim()}
                  onClick={() => updateMutation.mutate({
                    id: editingSubject.id,
                    name: editingSubject.name.trim(),
                    description: editingSubject.description.trim(),
                    is_active: editingSubject.is_active,
                  })}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
