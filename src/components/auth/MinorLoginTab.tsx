import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PinInput } from './PinInput';
import { User, Loader2, AlertTriangle, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function MinorLoginTab() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username.trim() || pin.length !== 4) return;

    setIsLoading(true);
    setError('');

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/minor-login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim().toLowerCase(), pin }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        if (data.attempts_remaining !== undefined) {
          setAttemptsRemaining(data.attempts_remaining);
        }
        if (data.locked) {
          setLockedMinutes(data.remaining_minutes);
        }
        setPin('');
        return;
      }

      // Success — try to establish a Supabase session
      if (data.session?.type === 'magic_link' && data.session?.email) {
        // Use OTP verification with the hashed token
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: data.session.email,
          token: data.session.hashed_token,
          type: 'email',
        });

        if (otpError) {
          // Fallback: store profile in sessionStorage for client-side session
          sessionStorage.setItem('minor_profile', JSON.stringify(data.profile));
          toast({ title: `Welcome, ${data.profile.full_name}!` });
          navigate('/dashboard');
          return;
        }
      } else {
        // No auth user — use client-side session
        sessionStorage.setItem('minor_profile', JSON.stringify(data.profile));
      }

      toast({ title: `Welcome, ${data.profile.full_name}!` });
      navigate('/dashboard');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit when PIN is complete
  const handlePinChange = (newPin: string) => {
    setPin(newPin);
    setError('');
    setAttemptsRemaining(null);
    setLockedMinutes(null);
    if (newPin.length === 4 && username.trim()) {
      setTimeout(() => handleSubmit(), 100);
    }
  };

  const isLocked = lockedMinutes !== null && lockedMinutes > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username" className="text-sm font-medium">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="username"
            type="text"
            placeholder="e.g. ahmed.aqt"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            className="pl-10 h-12"
            disabled={isLoading || isLocked}
            autoComplete="username"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">4-Digit PIN</Label>
        <PinInput
          value={pin}
          onChange={handlePinChange}
          disabled={isLoading || isLocked || !username.trim()}
          error={!!error}
        />
      </div>

      {error && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
          isLocked ? 'bg-destructive/10 text-destructive' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
        }`}>
          {isLocked ? <Lock className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
          <div>
            <p>{error}</p>
            {attemptsRemaining !== null && attemptsRemaining > 0 && (
              <p className="text-xs mt-1 opacity-75">{attemptsRemaining} attempt(s) left before lockout</p>
            )}
          </div>
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-12 btn-primary-glow"
        disabled={isLoading || pin.length !== 4 || !username.trim() || isLocked}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Verifying...
          </>
        ) : isLocked ? (
          <>
            <Lock className="h-5 w-5 mr-2" />
            Locked — Try Later
          </>
        ) : (
          'Sign In'
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Ask your parent or teacher if you forgot your username or PIN
      </p>
    </form>
  );
}
