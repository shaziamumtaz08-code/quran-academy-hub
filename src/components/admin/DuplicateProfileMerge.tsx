import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Loader2, CheckCircle2, Merge } from 'lucide-react';
import { format } from 'date-fns';

interface DuplicatePair {
  profile_a: string;
  profile_b: string;
  email: string;
  name_a: string;
  name_b: string;
  phone_a: string | null;
  phone_b: string | null;
  roles_a: string[];
  roles_b: string[];
  created_a: string;
  created_b: string;
  reg_id_a: string | null;
  reg_id_b: string | null;
  avatar_a: string | null;
  avatar_b: string | null;
}

// Tables that reference profiles by various column names
const FK_REASSIGN_QUERIES = [
  { table: 'user_roles', col: 'user_id' },
  { table: 'course_enrollments', col: 'student_id' },
  { table: 'course_class_students', col: 'student_id' },
  { table: 'course_class_staff', col: 'user_id' },
  { table: 'attendance', col: 'student_id' },
  { table: 'attendance', col: 'teacher_id' },
  { table: 'student_teacher_assignments', col: 'student_id' },
  { table: 'student_teacher_assignments', col: 'teacher_id' },
  { table: 'registration_submissions', col: 'matched_profile_id' },
  { table: 'student_parent_links', col: 'student_id' },
  { table: 'student_parent_links', col: 'parent_id' },
  { table: 'chat_members', col: 'user_id' },
  { table: 'fee_invoices', col: 'student_id' },
  { table: 'student_billing_plans', col: 'student_id' },
  { table: 'schedules', col: 'teacher_id' },
  { table: 'course_certificate_awards', col: 'student_id' },
  { table: 'ai_insights', col: 'user_id' },
  { table: 'tickets', col: 'creator_id' },
  { table: 'tickets', col: 'assignee_id' },
  { table: 'user_context', col: 'user_id' },
  { table: 'salary_records', col: 'teacher_id' },
];

export function DuplicateProfileMerge() {
  const queryClient = useQueryClient();
  const [mergeTarget, setMergeTarget] = useState<DuplicatePair | null>(null);
  const [primaryId, setPrimaryId] = useState<string>('');

  const { data: duplicates, isLoading } = useQuery({
    queryKey: ['duplicate-profiles'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, whatsapp_number, created_at, registration_id')
        .not('email', 'is', null)
        .neq('email', '')
        .order('email');

      if (!profiles?.length) return [];

      // Group by lowercase email
      const groups = new Map<string, typeof profiles>();
      for (const p of profiles) {
        const key = p.email!.toLowerCase();
        const arr = groups.get(key) || [];
        arr.push(p);
        groups.set(key, arr);
      }

      // Get roles for all profiles that are duplicates
      const dupIds: string[] = [];
      const pairs: DuplicatePair[] = [];

      groups.forEach((profs, email) => {
        if (profs.length < 2) return;
        profs.forEach(p => dupIds.push(p.id));
        // Create pairs from first two
        for (let i = 0; i < profs.length - 1; i++) {
          for (let j = i + 1; j < profs.length; j++) {
            pairs.push({
              profile_a: profs[i].id,
              profile_b: profs[j].id,
              email,
              name_a: profs[i].full_name || 'Unknown',
              name_b: profs[j].full_name || 'Unknown',
              phone_a: profs[i].whatsapp_number,
              phone_b: profs[j].whatsapp_number,
              roles_a: [],
              roles_b: [],
              created_a: profs[i].created_at,
              created_b: profs[j].created_at,
              reg_id_a: profs[i].registration_id,
              reg_id_b: profs[j].registration_id,
              avatar_a: null,
              avatar_b: null,
            });
          }
        }
      });

      if (!dupIds.length) return [];

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', dupIds);

      const roleMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const arr = roleMap.get(r.user_id) || [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });

      pairs.forEach(p => {
        p.roles_a = roleMap.get(p.profile_a) || [];
        p.roles_b = roleMap.get(p.profile_b) || [];
      });

      return pairs;
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ primary, secondary }: { primary: string; secondary: string }) => {
      let reassigned = 0;

      // Reassign all FK references
      for (const { table, col } of FK_REASSIGN_QUERIES) {
        try {
          const { data } = await supabase
            .from(table as any)
            .update({ [col]: primary } as any)
            .eq(col, secondary)
            .select('id');
          if (data?.length) reassigned += data.length;
        } catch {
          // Some tables may not exist or column mismatch — skip silently
        }
      }

      // Copy non-null fields from secondary to primary
      const { data: secProfile } = await supabase
        .from('profiles')
        .select('whatsapp_number, registration_id')
        .eq('id', secondary)
        .single();

      const { data: priProfile } = await supabase
        .from('profiles')
        .select('whatsapp_number, registration_id')
        .eq('id', primary)
        .single();

      if (secProfile && priProfile) {
        const updates: Record<string, any> = {};
        if (!priProfile.whatsapp_number && secProfile.whatsapp_number) updates.whatsapp_number = secProfile.whatsapp_number;
        if (!priProfile.registration_id && secProfile.registration_id) updates.registration_id = secProfile.registration_id;
        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', primary);
        }
      }

      // Merge roles
      const { data: secRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', secondary);

      if (secRoles?.length) {
        for (const r of secRoles) {
          await supabase.from('user_roles').upsert(
            { user_id: primary, role: r.role },
            { onConflict: 'user_id,role' }
          );
        }
        // Remove secondary roles
        await supabase.from('user_roles').delete().eq('user_id', secondary);
      }

      // Delete secondary profile
      await supabase.from('profiles').delete().eq('id', secondary);

      return reassigned;
    },
    onSuccess: (reassigned) => {
      toast.success(`Profiles merged. ${reassigned} records reassigned.`);
      setMergeTarget(null);
      setPrimaryId('');
      queryClient.invalidateQueries({ queryKey: ['duplicate-profiles'] });
    },
    onError: (err: any) => {
      toast.error(`Merge failed: ${err.message}`);
    },
  });

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  if (!duplicates?.length) return null;

  return (
    <>
      {/* Alert banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">
            {duplicates.length} duplicate profile{duplicates.length > 1 ? ' pairs' : ''} detected
          </p>
          <p className="text-xs text-muted-foreground">Profiles sharing the same email need to be merged</p>
        </div>
      </div>

      {/* Duplicate cards */}
      <div className="space-y-3">
        {duplicates.map((pair, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-muted-foreground">{pair.email}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              {/* Profile A */}
              <ProfileCard
                name={pair.name_a}
                phone={pair.phone_a}
                roles={pair.roles_a}
                created={pair.created_a}
                regId={pair.reg_id_a}
              />
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              {/* Profile B */}
              <ProfileCard
                name={pair.name_b}
                phone={pair.phone_b}
                roles={pair.roles_b}
                created={pair.created_b}
                regId={pair.reg_id_b}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => {
                  setMergeTarget(pair);
                  setPrimaryId(pair.profile_a);
                }}
              >
                <Merge className="w-3 h-3 mr-1" /> Merge
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Merge Dialog */}
      <Dialog open={!!mergeTarget} onOpenChange={() => { setMergeTarget(null); setPrimaryId(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-4 h-4" /> Merge Profiles
            </DialogTitle>
            <DialogDescription>
              Select which profile to keep as primary. The other will be merged into it and deleted.
            </DialogDescription>
          </DialogHeader>

          {mergeTarget && (
            <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="space-y-3">
              <div className={`p-3 rounded-lg border-2 transition-colors ${primaryId === mergeTarget.profile_a ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={mergeTarget.profile_a} id="a" />
                  <Label htmlFor="a" className="cursor-pointer flex-1">
                    <span className="font-bold text-sm">{mergeTarget.name_a}</span>
                    <div className="flex gap-1 mt-1">
                      {mergeTarget.roles_a.map(r => (
                        <Badge key={r} variant="secondary" className="text-[9px]">{r}</Badge>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Created {format(new Date(mergeTarget.created_a), 'MMM d, yyyy')}
                      {mergeTarget.reg_id_a && ` · ${mergeTarget.reg_id_a}`}
                    </p>
                  </Label>
                </div>
              </div>
              <div className={`p-3 rounded-lg border-2 transition-colors ${primaryId === mergeTarget.profile_b ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={mergeTarget.profile_b} id="b" />
                  <Label htmlFor="b" className="cursor-pointer flex-1">
                    <span className="font-bold text-sm">{mergeTarget.name_b}</span>
                    <div className="flex gap-1 mt-1">
                      {mergeTarget.roles_b.map(r => (
                        <Badge key={r} variant="secondary" className="text-[9px]">{r}</Badge>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Created {format(new Date(mergeTarget.created_b), 'MMM d, yyyy')}
                      {mergeTarget.reg_id_b && ` · ${mergeTarget.reg_id_b}`}
                    </p>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergeTarget(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!mergeTarget || !primaryId) return;
                const secondary = primaryId === mergeTarget.profile_a ? mergeTarget.profile_b : mergeTarget.profile_a;
                mergeMutation.mutate({ primary: primaryId, secondary });
              }}
              disabled={!primaryId || mergeMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {mergeMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Confirm Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileCard({ name, phone, roles, created, regId }: {
  name: string; phone: string | null; roles: string[]; created: string; regId: string | null;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
      <p className="text-sm font-bold text-foreground truncate">{name}</p>
      {phone && <p className="text-[10px] text-muted-foreground font-mono">{phone}</p>}
      <div className="flex flex-wrap gap-1">
        {roles.map(r => (
          <Badge key={r} variant="secondary" className="text-[9px] px-1.5 py-0">{r}</Badge>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {format(new Date(created), 'MMM yyyy')}
        {regId && <span className="ml-1 font-mono">{regId}</span>}
      </p>
    </div>
  );
}
