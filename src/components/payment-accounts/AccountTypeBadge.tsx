import { Badge } from '@/components/ui/badge';
import { Building2, Smartphone, Globe, Bitcoin, Landmark, CircleDollarSign } from 'lucide-react';
import { ACCOUNT_TYPE_GROUPS, ACCOUNT_TYPE_LABELS, PaymentAccountType } from './types';

const STYLES: Record<string, { cls: string; Icon: any }> = {
  bank_pkr:      { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900', Icon: Landmark },
  bank_fcy:      { cls: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900', Icon: Building2 },
  wallet:        { cls: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900', Icon: Smartphone },
  international: { cls: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900', Icon: Globe },
  other:         { cls: 'bg-muted text-muted-foreground border-border', Icon: CircleDollarSign },
};

export function AccountTypeBadge({ type, label }: { type: PaymentAccountType; label?: string }) {
  const group = ACCOUNT_TYPE_GROUPS[type];
  const cfg = STYLES[group] || STYLES.other;
  const Icon = type === 'crypto' ? Bitcoin : cfg.Icon;
  return (
    <Badge variant="outline" className={`gap-1 rounded-full border ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">{label || ACCOUNT_TYPE_LABELS[type]}</span>
    </Badge>
  );
}
