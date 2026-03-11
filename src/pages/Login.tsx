import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, ChevronDown, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import logoDark from '@/assets/logo-dark.jpg';
import { lovable } from '@/integrations/lovable/index';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Use sessionStorage instead of localStorage for recent emails (clears on browser close)
const RECENT_EMAILS_KEY = 'lms_recent_emails';
const MAX_RECENT_EMAILS = 3; // Reduced for privacy

const getRecentEmails = (): string[] => {
  try {
    const stored = sessionStorage.getItem(RECENT_EMAILS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentEmail = (email: string) => {
  try {
    const emails = getRecentEmails().filter(e => e !== email);
    emails.unshift(email);
    sessionStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(emails.slice(0, MAX_RECENT_EMAILS)));
  } catch {
    // Ignore storage errors
  }
};

const clearRecentEmails = () => {
  try {
    sessionStorage.removeItem(RECENT_EMAILS_KEY);
  } catch {
    // Ignore storage errors
  }
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { login, isAuthenticated, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load recent emails on mount
  useEffect(() => {
    setRecentEmails(getRecentEmails());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEmailDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (isAuthenticated && profile) {
      const role = profile.role;
      if (role === 'super_admin' || role === 'admin' || role?.startsWith('admin_')) {
        navigate('/admin');
      } else if (role === 'teacher' || role === 'examiner') {
        navigate('/teacher');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      loginSchema.parse({ email, password });

      const { error } = await login(email, password);
      if (error) {
        throw error;
      }
      
      // Save email to recent list on successful login
      saveRecentEmail(email);
      
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
    } catch (error) {
      const message = error instanceof z.ZodError 
        ? error.errors[0].message 
        : error instanceof Error 
          ? error.message 
          : 'An error occurred';
      
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectEmail = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setShowEmailDropdown(false);
  };

  const removeRecentEmail = (emailToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentEmails.filter(e => e !== emailToRemove);
    setRecentEmails(updated);
    sessionStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen flex islamic-pattern">
      {/* Left Panel - Decorative with Logo */}
      <div className="hidden lg:flex lg:w-1/2 header-navy relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 400 400" fill="none">
            <pattern id="islamic-geo" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M50 0L100 50L50 100L0 50z" fill="currentColor" />
              <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="1" fill="none" />
            </pattern>
            <rect width="400" height="400" fill="url(#islamic-geo)" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center px-12 text-primary-foreground w-full">
          <img 
            src={logoDark} 
            alt="Al-Quran Time Academy" 
            className="w-64 h-64 object-contain mb-8"
          />
          <h1 className="font-serif text-4xl font-bold leading-tight mb-6 text-center">
            Illuminate Your Path<br />Through Knowledge
          </h1>
          <p className="text-lg opacity-80 max-w-md text-center">
            Welcome to Al-Quran Time Academy. A dedicated platform for one-to-one Quranic education, 
            connecting teachers and students in their journey of learning.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img 
              src={logoDark} 
              alt="Al-Quran Time Academy" 
              className="w-32 h-32 object-contain mb-4"
            />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="font-serif text-3xl font-bold text-foreground">
              Welcome Back
            </h2>
            <p className="text-muted-foreground mt-2">
              Sign in to continue your learning journey
            </p>
          </div>

          {/* Google Sign-In */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 gap-3 font-semibold text-foreground border-border hover:bg-muted"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin + '/dashboard',
              });
              if (error) {
                toast({ title: "Google sign-in failed", description: String(error), variant: "destructive" });
              }
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative" ref={dropdownRef}>
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => recentEmails.length > 0 && setShowEmailDropdown(true)}
                  className="pl-10 pr-10 h-12"
                  autoComplete="off"
                  required
                />
                {recentEmails.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEmailDropdown(!showEmailDropdown)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${showEmailDropdown ? 'rotate-180' : ''}`} />
                  </button>
                )}
                
                {/* Recent Emails Dropdown */}
                {showEmailDropdown && recentEmails.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
                    <div className="py-1">
                      <p className="px-3 py-1 text-xs text-muted-foreground font-medium">Recent Emails</p>
                      {recentEmails.map((recentEmail) => (
                        <div
                          key={recentEmail}
                          className="flex items-center justify-between px-3 py-2 hover:bg-muted cursor-pointer group"
                          onClick={() => selectEmail(recentEmail)}
                        >
                          <span className="text-sm truncate">{recentEmail}</span>
                          <button
                            type="button"
                            onClick={(e) => removeRecentEmail(recentEmail, e)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 btn-primary-glow" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Need an account? Contact your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
