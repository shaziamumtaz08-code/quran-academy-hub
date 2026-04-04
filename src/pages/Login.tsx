import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, ChevronDown, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { MinorLoginTab } from '@/components/auth/MinorLoginTab';
import logoDark from '@/assets/logo-dark.jpg';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const RECENT_EMAILS_KEY = 'lms_recent_emails';
const MAX_RECENT_EMAILS = 3;

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
  } catch {}
};

export default function Login() {
  const [activeTab, setActiveTab] = useState<'email' | 'student'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { login, isAuthenticated, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setRecentEmails(getRecentEmails());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEmailDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      if (error) throw error;
      saveRecentEmail(email);
      toast({ title: "Welcome back!", description: "You have successfully logged in." });
    } catch (error) {
      const message = error instanceof z.ZodError
        ? error.errors[0].message
        : error instanceof Error
          ? error.message
          : 'An error occurred';
      toast({ title: "Login failed", description: message, variant: "destructive" });
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
          <img src={logoDark} alt="Al-Quran Time Academy" className="w-64 h-64 object-contain mb-8" />
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
            <img src={logoDark} alt="Al-Quran Time Academy" className="w-32 h-32 object-contain mb-4" />
          </div>

          <div className="mb-6 text-center lg:text-left">
            <h2 className="font-serif text-3xl font-bold text-foreground">Welcome Back</h2>
            <p className="text-muted-foreground mt-2">Sign in to continue your learning journey</p>
          </div>

          {/* Dual Tab Switcher */}
          <div className="flex rounded-xl bg-muted p-1 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'email'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('student')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'student'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🎓 Student PIN
            </button>
          </div>

          {activeTab === 'email' ? (
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
          ) : (
            <MinorLoginTab />
          )}

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
