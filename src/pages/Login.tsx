import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Mail, Lock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const demoAccounts = [
    { email: 'admin@quran.academy', password: 'admin123', role: 'Admin' },
    { email: 'teacher@quran.academy', password: 'teacher123', role: 'Teacher' },
    { email: 'student@quran.academy', password: 'student123', role: 'Student' },
    { email: 'parent@quran.academy', password: 'parent123', role: 'Parent' },
  ];

  return (
    <div className="min-h-screen flex islamic-pattern">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 400 400" fill="none">
            <pattern id="islamic-geo" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M50 0L100 50L50 100L0 50z" fill="currentColor" />
              <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="1" fill="none" />
            </pattern>
            <rect width="400" height="400" fill="url(#islamic-geo)" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-primary-foreground">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/10 flex items-center justify-center mb-8">
            <BookOpen className="h-10 w-10" />
          </div>
          <h1 className="font-serif text-5xl font-bold leading-tight mb-6">
            Illuminate Your Path<br />Through Knowledge
          </h1>
          <p className="text-lg opacity-80 max-w-md">
            Welcome to our online Quran Academy. A dedicated platform for one-to-one Quranic education, 
            connecting teachers and students in their journey of learning.
          </p>
          <div className="mt-12 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-foreground/10 flex items-center justify-center">
              <span className="font-serif text-xl">۱</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary-foreground/10 flex items-center justify-center">
              <span className="font-serif text-xl">۲</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary-foreground/10 flex items-center justify-center">
              <span className="font-serif text-xl">۳</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-foreground">Quran Academy</h1>
              <p className="text-xs text-muted-foreground">Learning Management</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-serif text-3xl font-bold text-foreground">Welcome Back</h2>
            <p className="text-muted-foreground mt-2">Sign in to continue your learning journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
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

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-8 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">Demo accounts for testing:</p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                  className="text-left p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <p className="text-xs font-medium text-foreground">{account.role}</p>
                  <p className="text-xs text-muted-foreground truncate">{account.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
