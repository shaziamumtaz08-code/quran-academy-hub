import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'gold';
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, variant = 'default', className }: StatCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:shadow-soft",
      variant === 'primary' && "bg-primary text-primary-foreground",
      variant === 'gold' && "bg-accent text-accent-foreground",
      variant === 'default' && "bg-card border border-border",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn(
            "text-sm font-medium",
            variant === 'default' ? "text-muted-foreground" : "opacity-80"
          )}>
            {title}
          </p>
          <p className="mt-2 text-3xl font-serif font-bold">{value}</p>
          {trend && (
            <p className={cn(
              "mt-2 text-xs font-medium",
              trend.isPositive ? "text-emerald-light" : "text-destructive"
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}% from last month
            </p>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-lg",
          variant === 'default' && "bg-secondary",
          variant === 'primary' && "bg-primary-foreground/10",
          variant === 'gold' && "bg-accent-foreground/10"
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
