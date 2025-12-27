import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import logoDark from '@/assets/logo-dark.jpg';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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

          <form onSubmit={handleSubmit} className="space-y-5">
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
