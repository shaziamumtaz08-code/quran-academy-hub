import { Building2, ChevronDown, Globe, MapPin } from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const MODEL_ICONS: Record<string, string> = {
  one_to_one: '👤',
  group: '👥',
};

export function DivisionSwitcher() {
  const { activeDivision, activeBranch, switcherOptions, setActiveDivisionId, isLoading } = useDivision();
  const navigate = useNavigate();

  if (isLoading || switcherOptions.length === 0) return null;

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
    : 'Select Workspace';

  const currentModelIcon = activeDivision ? MODEL_ICONS[activeDivision.model_type] || '🏢' : '🏢';

  // Group options by branch
  const groupedOptions = switcherOptions.reduce((acc, option) => {
    const branchLabel = option.label.split(' — ')[0];
    if (!acc[branchLabel]) acc[branchLabel] = [];
    acc[branchLabel].push(option);
    return acc;
  }, {} as Record<string, typeof switcherOptions>);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 h-9 text-xs"
        >
          <span>{currentModelIcon}</span>
          <span className="hidden sm:inline max-w-[180px] truncate">{currentLabel}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-card border-border z-50">
        {Object.entries(groupedOptions).map(([branchName, options], idx) => (
          <div key={branchName}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
              {branchName.toLowerCase().includes('online') ? (
                <Globe className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {branchName}
            </DropdownMenuLabel>
            {options.map((option) => (
              <DropdownMenuItem
                key={option.divisionId}
                onClick={() => setActiveDivisionId(option.divisionId)}
                className={cn(
                  'gap-2 pl-6',
                  activeDivision?.id === option.divisionId && 'bg-accent/10 text-accent font-medium'
                )}
              >
                <span>{MODEL_ICONS[option.modelType] || '🏢'}</span>
                <span className="flex-1 truncate">{option.label.split(' — ')[1] || option.label}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/select-division')}
          className="text-xs text-muted-foreground justify-center"
        >
          View all workspaces →
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
