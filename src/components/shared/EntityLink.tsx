import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface EntityLinkProps {
  /** Display text (name, count, label) */
  children: React.ReactNode;
  /** Navigation target */
  to: string;
  /** Optional query params or hash */
  state?: any;
  /** Visual variant */
  variant?: 'name' | 'count' | 'badge';
  className?: string;
}

/**
 * Clickable entity reference — use for student names, teacher names,
 * counts that link to filtered views, etc.
 */
export function EntityLink({ children, to, state, variant = 'name', className }: EntityLinkProps) {
  return (
    <Link
      to={to}
      state={state}
      className={cn(
        'inline-flex items-center gap-1 transition-colors duration-150 no-underline',
        variant === 'name' && 'text-primary hover:text-primary/80 font-semibold cursor-pointer hover:underline underline-offset-2',
        variant === 'count' && 'text-primary font-bold tabular-nums hover:text-primary/80 cursor-pointer',
        variant === 'badge' && 'px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer',
        className,
      )}
    >
      {children}
    </Link>
  );
}
