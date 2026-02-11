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
          className="gap-2 bg-[hsl(216,70%,18%)] hover:bg-[hsl(197,100%,45%)] text-white font-medium px-3 h-9 text-xs transition-colors duration-200 border border-[hsl(216,60%,28%)] hover:border-[hsl(197,100%,50%)] shadow-sm"
        >
          <span>{currentModelIcon}</span>
          <span className="hidden sm:inline max-w-[180px] truncate">{currentLabel}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 z-50 bg-[hsl(216,70%,11%)] border border-[hsl(216,60%,22%)] shadow-xl backdrop-blur-none"
      >
        {Object.entries(groupedOptions).map(([branchName, options], idx) => (
          <div key={branchName}>
            {idx > 0 && <DropdownMenuSeparator className="bg-[hsl(216,60%,20%)]" />}
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-[hsl(197,80%,65%)] flex items-center gap-1.5 px-3 py-2">
              {branchName.toLowerCase().includes('online') ? (
                <Globe className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {branchName}
            </DropdownMenuLabel>
            {options.map((option) => {
              const isActive = activeDivision?.id === option.divisionId;
              return (
                <DropdownMenuItem
                  key={option.divisionId}
                  onClick={() => setActiveDivisionId(option.divisionId)}
                  className={cn(
                    'gap-2 pl-6 mx-1 rounded-md cursor-pointer text-[hsl(210,20%,78%)] transition-colors duration-150',
                    'hover:bg-[hsl(197,100%,45%)] hover:text-white focus:bg-[hsl(197,100%,45%)] focus:text-white',
                    isActive && 'bg-[hsl(216,60%,20%)] text-[hsl(197,100%,65%)] font-semibold'
                  )}
                >
                  <span>{MODEL_ICONS[option.modelType] || '🏢'}</span>
                  <span className="flex-1 truncate">{option.label.split(' — ')[1] || option.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(197,100%,55%)] flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
        <DropdownMenuSeparator className="bg-[hsl(216,60%,20%)]" />
        <DropdownMenuItem
          onClick={() => navigate('/select-division')}
          className="text-xs text-[hsl(197,80%,65%)] justify-center mx-1 rounded-md hover:bg-[hsl(216,60%,18%)] hover:text-[hsl(197,100%,70%)] focus:bg-[hsl(216,60%,18%)] cursor-pointer"
        >
          View all workspaces →
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
