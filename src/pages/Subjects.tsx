import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
// Table imports removed — now using card grid layout
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Plus, Pencil, Trash2, Loader2, Shield, Users, Camera } from 'lucide-react';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { useNavigate } from 'react-router-dom';

export default function Subjects() {
  const { isSuperAdmin, hasPermission, activeRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; description: string; is_active: boolean; image_url?: string | null } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const ADMIN_ROLES = ['super_admin', 'admin', 'admin_division', 'admin_academic', 'admin_admissions', 'admin_fees'];
  const canAccess = isSuperAdmin || (activeRole && ADMIN_ROLES.includes(activeRole)) || hasPermission('settings.edit');

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
    enabled: canAccess,
  });

  // Fetch enrolled student counts per subject
  const { data: enrollmentCounts } = useQuery({
    queryKey: ['subject-enrollment-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('subject_id, student_id')
        .eq('status', 'active');
      if (error) throw error;
      
      const counts = new Map<string, number>();
      (data || []).forEach(row => {
        if (row.subject_id) {
          counts.set(row.subject_id, (counts.get(row.subject_id) || 0) + 1);
        }
      });
      return counts;
    },
    enabled: canAccess,
  });

  // Filter & search
  const filteredSubjects = useMemo(() => {
    if (!subjects) return [];
    return subjects.filter(s => {
      const matchesSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && s.is_active) || 
        (filterStatus === 'inactive' && !s.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [subjects, searchTerm, filterStatus]);

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
      toast({ title: 'Failed to create subject', description: error instanceof Error ? error.message : 'Please try again', variant: 'destructive' });
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
      toast({ title: 'Failed to update subject', description: error instanceof Error ? error.message : 'Please try again', variant: 'destructive' });
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
      toast({ title: 'Failed to delete subject', description: error instanceof Error ? error.message : 'Please try again', variant: 'destructive' });
    },
  });

  const handleEdit = (subject: typeof editingSubject) => {
    setEditingSubject(subject);
    setIsEditDialogOpen(true);
  };

  if (!canAccess) {
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
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Nazra, Hifz, Tajweed" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description of the subject" rows={3} />
                </div>
                <Button
                  className="w-full"
                  disabled={createMutation.isPending || !newName.trim()}
                  onClick={() => createMutation.mutate({ name: newName.trim(), description: newDescription.trim() })}
                >
                  {createMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>) : 'Create Subject'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Toolbar */}
        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                All Subjects
              </CardTitle>
              <CardDescription>View and manage all subjects in the system</CardDescription>
            </div>
            <TableToolbar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search subjects..."
              filterValue={filterStatus}
              onFilterChange={setFilterStatus}
              filterOptions={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              onReset={() => { setSearchTerm(''); setFilterStatus('all'); }}
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-2xl" />
                ))}
              </div>
            ) : filteredSubjects.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredSubjects.map((subject, idx) => {
                  const count = enrollmentCounts?.get(subject.id) || 0;
                  const palettes = [
                    { from: 'from-indigo-500', to: 'to-blue-700', ring: 'ring-indigo-500/30', text: 'text-indigo-50' },
                    { from: 'from-teal-500', to: 'to-emerald-700', ring: 'ring-teal-500/30', text: 'text-teal-50' },
                    { from: 'from-fuchsia-500', to: 'to-purple-700', ring: 'ring-fuchsia-500/30', text: 'text-fuchsia-50' },
                    { from: 'from-amber-500', to: 'to-orange-600', ring: 'ring-amber-500/30', text: 'text-amber-50' },
                    { from: 'from-rose-500', to: 'to-pink-700', ring: 'ring-rose-500/30', text: 'text-rose-50' },
                    { from: 'from-cyan-500', to: 'to-sky-700', ring: 'ring-cyan-500/30', text: 'text-cyan-50' },
                    { from: 'from-lime-500', to: 'to-green-700', ring: 'ring-lime-500/30', text: 'text-lime-50' },
                    { from: 'from-slate-600', to: 'to-slate-900', ring: 'ring-slate-500/30', text: 'text-slate-50' },
                  ];
                  const p = palettes[idx % palettes.length];
                  const initials = subject.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={subject.id}
                      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${p.from} ${p.to} text-white shadow-md ring-1 ${p.ring} transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:brightness-110`}
                    >
                      {/* Decorative blob */}
                      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                      <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-black/10 blur-2xl" />

                      {/* Top action buttons */}
                      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full bg-white/15 text-white hover:bg-white/30"
                          onClick={() => handleEdit({
                            id: subject.id, name: subject.name, description: subject.description || '', is_active: subject.is_active,
                          })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full bg-white/15 text-white hover:bg-rose-500/80"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this subject?')) {
                              deleteMutation.mutate(subject.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="relative p-5 space-y-4">
                        {/* Avatar / Icon */}
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm font-bold text-2xl tracking-tight shadow-inner">
                            {initials || <BookOpen className="h-6 w-6" />}
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              subject.is_active
                                ? 'bg-emerald-400/25 text-emerald-50 ring-1 ring-emerald-300/40'
                                : 'bg-white/15 text-white/80 ring-1 ring-white/20'
                            }`}
                          >
                            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${subject.is_active ? 'bg-emerald-300' : 'bg-white/60'}`} />
                            {subject.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {/* Title + Description */}
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold leading-tight tracking-tight">{subject.name}</h3>
                          <p className="text-sm text-white/75 line-clamp-2 min-h-[2.5rem]">
                            {subject.description || 'No description provided.'}
                          </p>
                        </div>

                        {/* Footer badges */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => count > 0 && navigate(`/students?subjectId=${subject.id}`)}
                            disabled={count === 0}
                            className={`inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm transition ${
                              count > 0 ? 'hover:bg-white/30 cursor-pointer' : 'opacity-70 cursor-default'
                            }`}
                          >
                            <Users className="h-3.5 w-3.5" />
                            {count} student{count !== 1 ? 's' : ''}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
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
                  <Input value={editingSubject.name} onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={editingSubject.description} onChange={(e) => setEditingSubject({ ...editingSubject, description: e.target.value })} rows={3} />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="font-medium">Active</Label>
                    <p className="text-sm text-muted-foreground">Subject is available for enrollment</p>
                  </div>
                  <Switch checked={editingSubject.is_active} onCheckedChange={(checked) => setEditingSubject({ ...editingSubject, is_active: checked })} />
                </div>
                <Button
                  className="w-full"
                  disabled={updateMutation.isPending || !editingSubject.name.trim()}
                  onClick={() => updateMutation.mutate({
                    id: editingSubject.id, name: editingSubject.name.trim(), description: editingSubject.description.trim(), is_active: editingSubject.is_active,
                  })}
                >
                  {updateMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : 'Save Changes'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
