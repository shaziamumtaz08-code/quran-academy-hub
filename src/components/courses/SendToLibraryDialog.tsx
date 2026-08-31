import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Library as LibraryIcon } from 'lucide-react';

interface SendToLibraryDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assetIds: string[];
  onDone: () => void;
}

export function SendToLibraryDialog({ open, onOpenChange, assetIds, onDone }: SendToLibraryDialogProps) {
  const [categoryId, setCategoryId] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [status, setStatus] = useState('published');
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [sending, setSending] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['library-categories-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library_categories')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const handleSend = async () => {
    if (!categoryId) { toast({ title: 'Choose a Library category', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('library-import-resource', {
        body: { assetIds, categoryId, visibility, status, allowDownloads },
      });
      if (error) throw error;
      const res = data as any;
      const failed = (res?.results || []).filter((r: any) => !r.ok);
      toast({
        title: `${res?.added ?? 0} sent to Library`,
        description: [
          res?.skipped ? `${res.skipped} already in Library` : null,
          failed.length ? `Failed: ${failed.map((f: any) => f.title).join(', ')}` : null,
        ].filter(Boolean).join(' · ') || undefined,
        variant: failed.length ? 'destructive' : undefined,
      });
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not send to Library', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LibraryIcon className="h-4 w-4" /> Send to Library
          </DialogTitle>
          <DialogDescription>
            {assetIds.length} item{assetIds.length === 1 ? '' : 's'} will be copied into the Library.
            Titles and file details are filled in automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Library category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Visible to</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="students">Students</SelectItem>
                <SelectItem value="parents">Parents</SelectItem>
                <SelectItem value="teachers">Teachers</SelectItem>
                <SelectItem value="admins">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-2.5">
            <Label className="text-xs">Allow downloads</Label>
            <Switch checked={allowDownloads} onCheckedChange={setAllowDownloads} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !categoryId}>
            {sending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Copying…</> : 'Send to Library'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
