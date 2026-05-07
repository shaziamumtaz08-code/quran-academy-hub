import React from 'react';
import { Button } from '@/components/ui/button';
import { Receipt, Zap, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  count: number;
  onPay?: () => void;
  onGenerate?: () => void;
  onExport?: () => void;
  onClear: () => void;
  payDisabled?: boolean;
}

export function BulkActionBar({ count, onPay, onGenerate, onExport, onClear, payDisabled }: BulkActionBarProps) {
  if (count === 0) return null;
  return (
    <div
      className={cn(
        'fixed left-1/2 bottom-6 z-40 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in duration-200',
      )}
    >
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-2 shadow-lg backdrop-blur-md">
        <span className="px-3 text-sm font-medium text-foreground whitespace-nowrap">
          {count} selected
        </span>
        <span className="h-5 w-px bg-border" />
        {onPay && (
          <Button size="sm" className="rounded-full h-8 px-3 gap-1.5" onClick={onPay} disabled={payDisabled}>
            <Receipt className="h-3.5 w-3.5" /> Bulk Pay
          </Button>
        )}
        {onGenerate && (
          <Button size="sm" variant="outline" className="rounded-full h-8 px-3 gap-1.5" onClick={onGenerate}>
            <Zap className="h-3.5 w-3.5" /> Generate
          </Button>
        )}
        {onExport && (
          <Button size="sm" variant="ghost" className="rounded-full h-8 px-3 gap-1.5" onClick={onExport}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full h-8 w-8 p-0 text-muted-foreground"
          onClick={onClear}
          aria-label="Deselect all"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
