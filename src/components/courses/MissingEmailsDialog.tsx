import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertTriangle, Phone, Save, UserCheck, Loader2 } from 'lucide-react';

interface MissingApplicant {
  id: string;
  data: Record<string, any>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicants: MissingApplicant[];
  courseId: string;
}

export function MissingEmailsDialog({ open, onOpenChange, applicants, courseId }: Props) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function setDraft(id: string, value: string) {
    setDrafts(prev => ({ ...prev, [id]: value }));
  }

  async function handleSaveEmail(applicant: MissingApplicant) {
    const email = (drafts[applicant.id] || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email');
      return;
    }
    setSavingId(applicant.id);
    const updatedData = { ...applicant.data, email };
    const { error } = await supabase
      .from('registration_submissions')
      .update({ data: updatedData as any })
      .eq('id', applicant.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Email saved');
    setDrafts(prev => { const n = { ...prev }; delete n[applicant.id]; return n; });
    queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
  }

  async function handleMarkWalkIn(applicant: MissingApplicant) {
    const phone = (applicant.data?.phone || applicant.data?.whatsapp_number || drafts[applicant.id] || '').trim();
    if (!phone) {
      toast.error('Phone number required for walk-in mode');
      return;
    }
    setSavingId(applicant.id);
    const updatedData = {
      ...applicant.data,
      phone,
      whatsapp_number: phone,
      contact_mode: 'walk_in',
      identifier_phone: phone,
    };
    const { error } = await supabase
      .from('registration_submissions')
      .update({ data: updatedData as any, source_tag: 'walk_in' })
      .eq('id', applicant.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Marked as walk-in (phone-only)');
    queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            {applicants.length} applicant{applicants.length !== 1 ? 's' : ''} missing email
          </DialogTitle>
          <DialogDescription>
            Add an email to enable enrollment, or mark as walk-in to use phone as identifier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {applicants.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              All applicants have an email or walk-in identifier. ✓
            </div>
          )}

          {applicants.map(a => {
            const d = a.data || {};
            const phone = d.phone || d.whatsapp_number || '';
            const isWalkIn = d.contact_mode === 'walk_in';
            const draft = drafts[a.id] || '';
            return (
              <div key={a.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{d.full_name || '(no name)'}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      {phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {phone}</span>}
                      {d.country && <span>• {d.country}</span>}
                      {isWalkIn && <Badge variant="secondary" className="text-[10px]">Walk-in</Badge>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    placeholder="Enter email…"
                    value={draft}
                    onChange={e => setDraft(a.id, e.target.value)}
                    className="h-9 text-sm flex-1"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveEmail(a)}
                      disabled={savingId === a.id || !draft.includes('@')}
                      className="gap-1.5">
                      {savingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkWalkIn(a)}
                      disabled={savingId === a.id || (!phone && !draft) || isWalkIn}
                      className="gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" />
                      {isWalkIn ? 'Walk-in' : 'Mark Walk-in'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
