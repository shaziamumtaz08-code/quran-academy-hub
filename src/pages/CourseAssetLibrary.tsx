import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { cn } from '@/lib/utils';
import {
  Plus, Search, FileText, Video, File, BookOpen, Archive, Copy,
  Trash2, Pencil, Eye, Tag, Filter, MoreHorizontal, Star,
  MessageSquare, ClipboardList, Megaphone, StickyNote, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ─────────────────────────────────────────────
interface LibraryAsset {
  id: string;
  title: string;
  asset_type: string;
  content_url: string | null;
  content_html: string | null;
  metadata: Record<string, any>;
  tags: string[];
  status: string;
  version: number;
  owner_id: string | null;
  visibility: string;
  course_id: string | null;
  branch_id: string | null;
  division_id: string | null;
  created_at: string;
  updated_at: string;
  owner?: { full_name: string } | null;
  course?: { name: string } | null;
}

const ASSET_TYPES = [
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'pdf', label: 'PDF', icon: File },
  { value: 'quiz', label: 'Quiz', icon: ClipboardList },
  { value: 'assignment', label: 'Assignment', icon: BookOpen },
  { value: 'zoom_session', label: 'Zoom/Jitsi', icon: Video },
  { value: 'whatsapp_template', label: 'WhatsApp', icon: MessageSquare },
  { value: 'announcement', label: 'Announcement', icon: Megaphone },
  { value: 'note', label: 'Note', icon: StickyNote },
];

const STATUSES = ['draft', 'published', 'archived'];
const VISIBILITIES = ['internal', 'public', 'course_only'];

function getTypeIcon(type: string) {
  const found = ASSET_TYPES.find(t => t.value === type);
  const Icon = found?.icon || FileText;
  return <Icon className="h-4 w-4" />;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'published': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    case 'draft': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    case 'archived': return 'bg-muted text-muted-foreground border-border';
    default: return '';
  }
}

// ─── Main Component ────────────────────────────────────
export default function CourseAssetLibrary() {
  const queryClient = useQueryClient();
  const { activeRole, profile } = useAuth();
  const { activeBranch, activeDivision } = useDivision();

  const canManage = useMemo(() => {
    const allowed = new Set(['super_admin', 'admin', 'admin_academic', 'teacher']);
    return (profile?.roles || []).some((r: string) => allowed.has(r)) || (activeRole ? allowed.has(activeRole) : false);
  }, [activeRole, profile?.roles]);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailAsset, setDetailAsset] = useState<LibraryAsset | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('document');
  const [formContentUrl, setFormContentUrl] = useState('');
  const [formContentHtml, setFormContentHtml] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formStatus, setFormStatus] = useState('draft');
  const [formVisibility, setFormVisibility] = useState('internal');
  const [editingId, setEditingId] = useState<string | null>(null);

  // ─── Query ──────────────────────────────────────────
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['library-assets', activeDivision?.id],
    queryFn: async () => {
      let q = supabase.from('course_library_assets')
        .select('*, owner:profiles!course_library_assets_owner_id_fkey(full_name), course:courses!course_library_assets_course_id_fkey(name)')
        .order('updated_at', { ascending: false });
      if (activeDivision?.id) q = q.eq('division_id', activeDivision.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LibraryAsset[];
    },
  });

  // ─── Mutations ──────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: formTitle.trim() || 'Untitled Asset',
        asset_type: formType,
        content_url: formContentUrl || null,
        content_html: formContentHtml || null,
        tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
        status: formStatus,
        visibility: formVisibility,
        owner_id: profile?.id,
        branch_id: activeBranch?.id || null,
        division_id: activeDivision?.id || null,
      };

      if (editingId) {
        const { error } = await supabase.from('course_library_assets').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_library_assets').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-assets'] });
      toast({ title: editingId ? 'Asset updated' : 'Asset created' });
      closeForm();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_library_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-assets'] });
      toast({ title: 'Asset deleted' });
      setDetailAsset(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (asset: LibraryAsset) => {
      const { error } = await supabase.from('course_library_assets').insert({
        title: `${asset.title} (Copy)`,
        asset_type: asset.asset_type,
        content_url: asset.content_url,
        content_html: asset.content_html,
        metadata: asset.metadata,
        tags: asset.tags,
        status: 'draft',
        visibility: asset.visibility,
        owner_id: profile?.id,
        branch_id: activeBranch?.id || null,
        division_id: activeDivision?.id || null,
        version: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-assets'] });
      toast({ title: 'Asset duplicated' });
    },
  });

  const closeForm = () => {
    setCreateOpen(false); setEditingId(null); setFormTitle(''); setFormType('document');
    setFormContentUrl(''); setFormContentHtml(''); setFormTags(''); setFormStatus('draft'); setFormVisibility('internal');
  };

  const openEdit = (a: LibraryAsset) => {
    setEditingId(a.id); setFormTitle(a.title); setFormType(a.asset_type);
    setFormContentUrl(a.content_url || ''); setFormContentHtml(a.content_html || '');
    setFormTags((a.tags || []).join(', ')); setFormStatus(a.status); setFormVisibility(a.visibility);
    setCreateOpen(true);
  };

  // ─── Filtering ──────────────────────────────────────
  const filtered = useMemo(() => {
    return assets.filter(a => {
      const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
        (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchType = filterType === 'all' || a.asset_type === filterType;
      const matchStatus = filterStatus === 'all' || a.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [assets, search, filterType, filterStatus]);

  const stats = useMemo(() => ({
    total: assets.length,
    published: assets.filter(a => a.status === 'published').length,
    types: new Set(assets.map(a => a.asset_type)).size,
  }), [assets]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="page-header-premium rounded-xl p-6 relative overflow-hidden">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                <Star className="h-6 w-6" /> Asset Library
              </h1>
              <p className="text-white/80 mt-1">Reusable content assets — videos, PDFs, quizzes, templates, and more</p>
            </div>
            {canManage && (
              <Button onClick={() => { setEditingId(null); setCreateOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-1" /> New Asset
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Assets', value: stats.total },
            { label: 'Published', value: stats.published },
            { label: 'Asset Types', value: stats.types },
          ].map(s => (
            <Card key={s.label} className="shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search assets or tags…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No assets found. Create your first reusable asset.</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(asset => (
              <Card key={asset.id} className="group hover:shadow-md transition-all border-border/60 overflow-hidden cursor-pointer"
                onClick={() => setDetailAsset(asset)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-md bg-muted">{getTypeIcon(asset.asset_type)}</div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{asset.title}</h3>
                        <p className="text-xs text-muted-foreground">v{asset.version} • {asset.owner?.full_name || 'Unknown'}</p>
                      </div>
                    </div>
                    <Badge className={cn('text-xs shrink-0', getStatusColor(asset.status))}>{asset.status}</Badge>
                  </div>
                  {asset.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.slice(0, 4).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">{tag}</Badge>
                      ))}
                      {asset.tags.length > 4 && <span className="text-xs text-muted-foreground">+{asset.tags.length - 4}</span>}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
                    <span>{ASSET_TYPES.find(t => t.value === asset.asset_type)?.label}</span>
                    <span>{format(new Date(asset.updated_at), 'MMM d, yyyy')}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Sheet */}
        {detailAsset && (
          <Dialog open={!!detailAsset} onOpenChange={() => setDetailAsset(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{getTypeIcon(detailAsset.asset_type)} {detailAsset.title}</DialogTitle>
                <DialogDescription>
                  {ASSET_TYPES.find(t => t.value === detailAsset.asset_type)?.label} • v{detailAsset.version} • {detailAsset.visibility}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {detailAsset.content_url && (
                  <div><Label className="text-xs text-muted-foreground">Content URL</Label>
                    <a href={detailAsset.content_url} target="_blank" className="text-sm text-accent hover:underline flex items-center gap-1">
                      {detailAsset.content_url} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {detailAsset.content_html && (
                  <div><Label className="text-xs text-muted-foreground">Content</Label>
                    <div className="text-sm border rounded-lg p-3 max-h-40 overflow-y-auto bg-muted/30" dangerouslySetInnerHTML={{ __html: detailAsset.content_html }} />
                  </div>
                )}
                {detailAsset.tags?.length > 0 && (
                  <div><Label className="text-xs text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">{detailAsset.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                  </div>
                )}
                {detailAsset.course && (
                  <div><Label className="text-xs text-muted-foreground">Linked Course</Label>
                    <p className="text-sm">{detailAsset.course.name}</p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Created {format(new Date(detailAsset.created_at), 'PPp')} • Updated {format(new Date(detailAsset.updated_at), 'PPp')}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => { duplicateMutation.mutate(detailAsset); setDetailAsset(null); }}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
                </Button>
                <Button variant="outline" size="sm" onClick={() => { openEdit(detailAsset); setDetailAsset(null); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(detailAsset.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={createOpen} onOpenChange={v => { if (!v) closeForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Asset' : 'New Asset'}</DialogTitle>
              <DialogDescription>Create a reusable content asset</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Asset title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select value={formVisibility} onValueChange={setFormVisibility}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VISIBILITIES.map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1).replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {['video', 'pdf', 'document', 'zoom_session'].includes(formType) && (
                <div className="space-y-1.5">
                  <Label>Content URL</Label>
                  <Input value={formContentUrl} onChange={e => setFormContentUrl(e.target.value)} placeholder="https://..." />
                </div>
              )}
              {['document', 'note', 'announcement', 'whatsapp_template', 'assignment', 'quiz'].includes(formType) && (
                <div className="space-y-1.5">
                  <Label>Content</Label>
                  <Textarea value={formContentHtml} onChange={e => setFormContentHtml(e.target.value)} placeholder="Content text or HTML…" rows={5} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Tags (comma-separated)</Label>
                <Input value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="arabic, beginner, grammar" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formTitle.trim()}>
                {saveMutation.isPending ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
