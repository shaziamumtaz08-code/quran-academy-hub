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
    mutationFn: async (data: { id: string; name: string; description: string; is_active: boolean; image_url?: string | null }) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
      };
      if (data.image_url !== undefined) payload.image_url = data.image_url;
      const { error } = await supabase.from('subjects').update(payload).eq('id', data.id);
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

  const handleImageUpload = async (subjectId: string, file: File) => {
    try {
      setUploadingId(subjectId);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${subjectId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('subject-images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('subject-images').getPublicUrl(path);
      const { error: updErr } = await supabase.from('subjects').update({ image_url: pub.publicUrl } as never).eq('id', subjectId);
      if (updErr) throw updErr;
      queryClient.invalidateQueries({ queryKey: ['subjects-all'] });
      toast({ title: 'Image updated' });
    } catch (e) {
      toast({ title: 'Upload failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredSubjects.map((subject, idx) => {
                  const count = enrollmentCounts?.get(subject.id) || 0;
                  const palettes = [
                    { tint: 'from-rose-50 to-rose-100/60', accent: 'bg-rose-200/40', dot: 'bg-rose-400' },          // dusty rose
                    { tint: 'from-emerald-50 to-emerald-100/60', accent: 'bg-emerald-200/40', dot: 'bg-emerald-400' }, // sage
                    { tint: 'from-slate-50 to-slate-100/70', accent: 'bg-slate-200/40', dot: 'bg-slate-400' },     // warm slate
                    { tint: 'from-indigo-50 to-indigo-100/60', accent: 'bg-indigo-200/40', dot: 'bg-indigo-400' }, // soft indigo
                    { tint: 'from-amber-50 to-amber-100/60', accent: 'bg-amber-200/40', dot: 'bg-amber-400' },     // muted gold
                    { tint: 'from-teal-50 to-teal-100/60', accent: 'bg-teal-200/40', dot: 'bg-teal-400' },         // dusty teal
                  ];
                  const p = palettes[idx % palettes.length];
                  const keyword = encodeURIComponent(subject.name.toLowerCase().includes('quran') || subject.name.toLowerCase().includes('hifz') || subject.name.toLowerCase().includes('nazra') ? 'quran,mosque' : subject.name.toLowerCase().includes('arab') ? 'arabic,calligraphy' : subject.name.toLowerCase().includes('deen') || subject.name.toLowerCase().includes('fehme') ? 'islamic,books' : subject.name.toLowerCase().includes('nahv') || subject.name.toLowerCase().includes('grammar') ? 'arabic,manuscript' : 'study,books');
                  const fallbackImg = `https://source.unsplash.com/400x240/?${keyword}&sig=${subject.id.slice(0, 6)}`;
                  const imgSrc = (subject as { image_url?: string | null }).image_url || fallbackImg;
                  const fileInputId = `subject-img-${subject.id}`;
                  return (
                    <div
                      key={subject.id}
                      className={`group relative overflow-hidden rounded-[20px] border border-white/60 bg-gradient-to-br ${p.tint} shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]`}
                    >
                      {/* Image area */}
                      <div className="relative h-36 w-full overflow-hidden">
                        <img
                          src={imgSrc}
                          alt={subject.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackImg; }}
                        />
                        {/* Soft gradient overlay fading to card body */}
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/95`} />
                        {/* Grain texture */}
                        <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

                        {/* Hover action icons (top-right) */}
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700 backdrop-blur-md ring-1 ring-black/5 hover:bg-white"
                            onClick={() => handleEdit({
                              id: subject.id, name: subject.name, description: subject.description || '', is_active: subject.is_active,
                              image_url: (subject as { image_url?: string | null }).image_url || null,
                            })}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-rose-600 backdrop-blur-md ring-1 ring-black/5 hover:bg-white"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this subject?')) {
                                deleteMutation.mutate(subject.id);
                              }
                            }}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Camera upload (bottom-right of image) */}
                        <label
                          htmlFor={fileInputId}
                          className="absolute bottom-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/85 text-slate-700 backdrop-blur-md ring-1 ring-black/5 transition hover:bg-white"
                          title="Upload custom image"
                        >
                          {uploadingId === subject.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Camera className="h-3.5 w-3.5" />}
                        </label>
                        <input
                          id={fileInputId}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(subject.id, f);
                            e.target.value = '';
                          }}
                        />
                      </div>

                      {/* Body */}
                      <div className="relative space-y-3 px-5 pb-5 pt-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif text-lg font-semibold leading-tight text-slate-800">
                            {subject.name}
                          </h3>
                          <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            <span className={`h-1.5 w-1.5 rounded-full ${subject.is_active ? p.dot : 'bg-slate-300'}`} />
                            {subject.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-500/90 line-clamp-2 min-h-[2.5rem]">
                          {subject.description || 'No description provided.'}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => count > 0 && navigate(`/students?subjectId=${subject.id}`)}
                            disabled={count === 0}
                            className={`inline-flex items-center gap-1.5 rounded-full ${p.accent} px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-black/5 transition ${
                              count > 0 ? 'hover:brightness-95 cursor-pointer' : 'opacity-70 cursor-default'
                            }`}
                          >
                            <Users className="h-3 w-3" />
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
