import { Building2, ChevronDown } from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MODEL_ICONS: Record<string, string> = {
  one_to_one: '👤',
  group: '👥',
};

export function DivisionSwitcher() {
  const { activeDivision, switcherOptions, setActiveDivisionId, isLoading } = useDivision();

  // Don't show if loading or no options
  if (isLoading || switcherOptions.length === 0) return null;

  // Don't show dropdown if only one option — just show a badge
  if (switcherOptions.length === 1) {
    return (
      <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs font-medium border-border">
        <Building2 className="h-3.5 w-3.5" />
        {switcherOptions[0].label}
      </Badge>
    );
  }

  const currentLabel = activeDivision
    ? switcherOptions.find(o => o.divisionId === activeDivision.id)?.label || activeDivision.name
    : 'Select Division';

  const currentModelIcon = activeDivision ? MODEL_ICONS[activeDivision.model_type] || '🏢' : '🏢';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 h-9 text-xs"
        >
          <span>{currentModelIcon}</span>
          <span className="hidden sm:inline max-w-[160px] truncate">{currentLabel}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-border z-50">
        {switcherOptions.map((option) => (
          <DropdownMenuItem
            key={option.divisionId}
            onClick={() => setActiveDivisionId(option.divisionId)}
            className={cn(
              'gap-2',
              activeDivision?.id === option.divisionId && 'bg-accent'
            )}
          >
            <span>{MODEL_ICONS[option.modelType] || '🏢'}</span>
            <span className="flex-1 truncate">{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
