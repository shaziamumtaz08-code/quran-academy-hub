import React from 'react';
import { cn } from '@/lib/utils';

interface CompactFormLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function CompactFormLayout({ children, className }: CompactFormLayoutProps) {
  return (
    <div className={cn(
      "bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800",
      className
    )}>
      {children}
    </div>
  );
}

interface FormGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3;
}

export function FormGrid({ children, className, columns = 3 }: FormGridProps) {
  return (
    <div className={cn(
      "grid gap-3",
      columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
      className
    )}>
      {children}
    </div>
  );
}

interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
  span?: 'full' | 'half' | 'third';
}

export function FormField({ children, className, span }: FormFieldProps) {
  return (
    <div className={cn(
      "space-y-1.5",
      span === 'full' && "sm:col-span-2 lg:col-span-3",
      span === 'half' && "lg:col-span-2",
      className
    )}>
      {children}
    </div>
  );
}

export function FormLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("text-xs font-medium text-foreground", className)}>
      {children}
    </label>
  );
}

interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function FormActions({ children, className }: FormActionsProps) {
  return (
    <div className={cn(
      "flex justify-end gap-2 pt-3 border-t border-blue-200 dark:border-blue-800 mt-3",
      className
    )}>
      {children}
    </div>
  );
}
