import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, Key, Eye, EyeOff, Shield, Clock } from 'lucide-react';

interface LinkedChild {
  id: string;
  student_id: string;
  full_name: string;
  email: string | null;
  hasPin: boolean;
  username: string | null;
  oversight_level: string;
}

export function FamilyManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resetChildId, setResetChildId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const { data: children, isLoading } = useQuery({
    queryKey: ['family-children', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: links } = await supabase
        .from('student_parent_links')
        .select(`
          id, student_id,
          student:profiles!student_parent_links_student_id_fkey(id, full_name, email)
        `)
        .eq('parent_id', user.id);

      // Fetch oversight levels separately to avoid type issues
      const linkIds = links?.map(l => l.id) || [];
      let oversightMap = new Map<string, string>();
      if (linkIds.length) {
        const { data: oversightData } = await supabase
          .from('student_parent_links')
          .select('id, oversight_level')
          .in('id', linkIds) as any;
        if (oversightData) {
          for (const o of oversightData) {
            oversightMap.set(o.id, o.oversight_level || 'none');
          }
        }
      }

      if (!links?.length) return [];

      const studentIds = links.map(l => l.student_id);
      const { data: credentials } = await supabase
        .from('minor_credentials')
        .select('profile_id, username')
        .in('profile_id', studentIds);

      const credMap = new Map(credentials?.map(c => [c.profile_id, c]) || []);

      return links.map(link => {
        const student = link.student as any;
        const cred = credMap.get(link.student_id);
        return {
          id: link.id,
          student_id: link.student_id,
          full_name: student?.full_name || 'Unknown',
          email: student?.email || null,
          hasPin: !!cred,
          username: cred?.username || null,
          oversight_level: oversightMap.get(link.id) || 'none',
        };
      }) as LinkedChild[];
    },
    enabled: !!user?.id,
  });

  const resetPinMutation = useMutation({
    mutationFn: async ({ studentId, pin }: { studentId: string; pin: string }) => {
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        throw new Error('PIN must be exactly 4 digits');
      }

      // Hash the PIN (SHA-256)
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase
        .from('minor_credentials')
        .update({ pin_hash: pinHash, failed_attempts: 0, locked_until: null })
        .eq('profile_id', studentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'PIN Reset', description: 'Your child\'s PIN has been updated successfully.' });
      setResetChildId(null);
      setNewPin('');
      queryClient.invalidateQueries({ queryKey: ['family-children'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateOversightMutation = useMutation({
    mutationFn: async ({ linkId, level }: { linkId: string; level: string }) => {
      const { error } = await supabase
        .from('student_parent_links')
        .update({ oversight_level: level })
        .eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Updated', description: 'Oversight level changed.' });
      queryClient.invalidateQueries({ queryKey: ['family-children'] });
    },
  });

  if (isLoading) {
    return <div className="p-4 text-muted-foreground text-sm">Loading family...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-extrabold text-foreground">Family Members</h3>
      </div>

      {!children?.length ? (
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">No children linked yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {children.map(child => (
            <div key={child.id} className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky/10 flex items-center justify-center text-sky font-bold text-sm">
                    {child.full_name[0]}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground">{child.full_name}</p>
                    {child.username && (
                      <p className="text-[10px] text-muted-foreground font-mono">@{child.username}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Oversight toggle */}
                <select
                  value={child.oversight_level}
                  onChange={(e) => updateOversightMutation.mutate({ linkId: child.id, level: e.target.value })}
                  className="text-[10px] px-2 py-1 rounded-lg border border-border bg-background text-foreground font-semibold"
                >
                  <option value="none">No oversight</option>
                  <option value="notifications">Notifications only</option>
                  <option value="full">Full dashboard</option>
                </select>

                {/* PIN Reset */}
                {child.hasPin && (
                  <Dialog open={resetChildId === child.student_id} onOpenChange={(o) => { if (!o) { setResetChildId(null); setNewPin(''); } }}>
                    <DialogTrigger asChild>
                      <button
                        onClick={() => setResetChildId(child.student_id)}
                        className="text-[10px] px-2 py-1 rounded-lg border border-gold/30 bg-gold/5 text-gold font-bold flex items-center gap-1 hover:bg-gold/10 transition-colors"
                      >
                        <Key className="w-3 h-3" /> Reset PIN
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="text-base">Reset PIN for {child.full_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div>
                          <Label className="text-xs font-bold">New 4-digit PIN</Label>
                          <div className="relative mt-1">
                            <Input
                              type={showPin ? 'text' : 'password'}
                              maxLength={4}
                              pattern="\d{4}"
                              inputMode="numeric"
                              value={newPin}
                              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="••••"
                              className="text-center text-xl tracking-[0.5em] font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPin(!showPin)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                            >
                              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          disabled={newPin.length !== 4 || resetPinMutation.isPending}
                          onClick={() => resetPinMutation.mutate({ studentId: child.student_id, pin: newPin })}
                        >
                          {resetPinMutation.isPending ? 'Resetting...' : 'Set New PIN'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Status badges */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${child.hasPin ? 'bg-teal/10 text-teal' : 'bg-muted text-muted-foreground'}`}>
                  {child.hasPin ? '🔐 PIN Set' : 'No PIN'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
