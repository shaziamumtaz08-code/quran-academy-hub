import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUBJECT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  nazra: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  qaida: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  hifz: { bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  arabic: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  tarbiyah: { bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  tajweed: { bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
};

function getColors(name: string | null) {
  const lower = (name || '').toLowerCase();
  for (const [key, colors] of Object.entries(SUBJECT_COLORS)) {
    if (lower.includes(key)) return colors;
  }
  return { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
}

interface SubjectBadgeProps {
  name: string | null | undefined;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function SubjectBadge({ name, showIcon = true, size = 'sm', className }: SubjectBadgeProps) {
  if (!name) return null;
  const colors = getColors(name);

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-0 gap-1 font-normal',
        colors.bg, colors.text,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
        className
      )}
    >
      {showIcon ? (
        <BookOpen className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      ) : (
        <div className={cn('rounded-full', colors.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      )}
      {name}
    </Badge>
  );
}
