import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Loader2 } from 'lucide-react';

/**
 * Mandatory password-change gate. Rendered instead of the app whenever the
 * signed-in user's profile has force_password_reset = true (set on every
 * account created with the academy default password), so a guessable default
 * password can never be used to browse the app.
 */
export function ForcePasswordChange() {
  const { profile, logout } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      toast({ title: 'Could not update password', description: error.message, variant: 'destructive' });
      return;
    }
    if (!profile?.id) {
      setSaving(false);
      toast({
        title: 'Password updated, but setup could not finish',
        description: 'Please sign out and contact an administrator.',
        variant: 'destructive',
      });
      return;
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({ force_password_reset: false })
      .eq('id', profile.id)
      .select('force_password_reset')
      .single();

    if (profileError || updatedProfile?.force_password_reset !== false) {
      setSaving(false);
      toast({
        title: 'Password updated, but setup could not finish',
        description: 'Please try once more or contact an administrator.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Password updated', description: 'Please sign in again with your new password.' });
    await logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            Your account still uses the temporary password issued by the academy. Choose a private
            password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => logout()}>
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ForcePasswordChange;
