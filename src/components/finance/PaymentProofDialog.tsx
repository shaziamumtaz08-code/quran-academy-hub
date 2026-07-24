import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, FileText, Ban, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSignedUrl, resolveFileUrl } from '@/lib/signedUrl';
import { format, parseISO } from 'date-fns';

interface ProofInvoice {
  id: string;
  billing_month: string;
  payment_proof_url?: string | null;
  payment_proof_note?: string | null;
  payment_proof_submitted_at?: string | null;
  profiles?: { full_name: string } | null;
}

interface Props {
  invoice: ProofInvoice | null;
  onClose: () => void;
  onRejected?: () => void;
  onMarkPaid?: (invoice: ProofInvoice) => void;
}

export function PaymentProofDialog({ invoice, onClose, onRejected, onMarkPaid }: Props) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const signed = useSignedUrl(invoice?.payment_proof_url || null);

  if (!invoice || !invoice.payment_proof_url) return null;
  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(invoice.payment_proof_url);

  const handleReject = async () => {
    if (!reason.trim()) {
      toast({ title: 'Please add a short reason', variant: 'destructive' });
      return;
    }
    setRejecting(true);
    const { error } = await supabase.rpc('reject_payment_proof', {
      _invoice_id: invoice.id,
      _reason: reason.trim(),
    });
    setRejecting(false);
    if (error) {
      toast({ title: 'Reject failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Proof rejected', description: 'Parent has been notified.' });
    onRejected?.();
    onClose();
  };

  const openFresh = async () => {
    const fresh = await resolveFileUrl(invoice.payment_proof_url);
    if (fresh) window.open(fresh, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Payment Proof
            <Badge variant="outline" className="text-[10px]">Awaiting review</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-muted-foreground text-xs">
            {invoice.profiles?.full_name} · {invoice.billing_month}
            {invoice.payment_proof_submitted_at && (
              <> · submitted {format(parseISO(invoice.payment_proof_submitted_at), 'dd MMM yyyy HH:mm')}</>
            )}
          </div>

          {invoice.payment_proof_note && (
            <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
              <span className="font-medium">Parent note: </span>
              {invoice.payment_proof_note}
            </div>
          )}

          <div className="rounded-md border border-border p-2 bg-background">
            {signed && isImage ? (
              <img src={signed} alt="Payment proof" className="max-h-[420px] w-auto mx-auto rounded" />
            ) : signed ? (
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Attached file</span>
                </div>
                <Button size="sm" variant="outline" onClick={openFresh}>
                  Open <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">Loading…</div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Reject reason (only used if you reject)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Screenshot unclear — please re-upload"
              className="h-16 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <Button variant="outline" onClick={openFresh}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in new tab
          </Button>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
            {onMarkPaid && (
              <Button onClick={() => { onMarkPaid(invoice); onClose(); }}>
                <Receipt className="h-3.5 w-3.5 mr-1" /> Mark Paid
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
