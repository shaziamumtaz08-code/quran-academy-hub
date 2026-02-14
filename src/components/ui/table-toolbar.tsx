import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw } from 'lucide-react';

type SortOption = { value: string; label: string };
type FilterOption = { value: string; label: string };

interface TableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: SortOption[];
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  filterLabel?: string;
  onReset?: () => void;
  children?: React.ReactNode;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  sortValue,
  onSortChange,
  sortOptions = [],
  filterValue,
  onFilterChange,
  filterOptions = [],
  filterLabel = 'Status',
  onReset,
  children,
}: TableToolbarProps) {
  const hasActiveFilters = searchValue || (filterValue && filterValue !== 'all') || (sortValue && sortValue !== sortOptions[0]?.value);

  return (
    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          className="pl-10"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Sort */}
      {onSortChange && sortOptions.length > 0 && (
        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Filter */}
      {onFilterChange && filterOptions.length > 0 && (
        <Select value={filterValue || 'all'} onValueChange={onFilterChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={filterLabel} />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Extra children */}
      {children}

      {/* Reset */}
      {onReset && hasActiveFilters && (
        <Button variant="outline" size="icon" onClick={onReset} title="Reset Filters">
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
