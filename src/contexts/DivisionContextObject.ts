import { createContext } from 'react';

export type DivisionModelType = 'one_to_one' | 'group';
export type BranchType = 'online' | 'onsite';

export interface Division {
  id: string;
  name: string;
  model_type: DivisionModelType;
  branch_id: string;
  is_active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  type: BranchType;
  org_id: string;
  timezone: string | null;
}

export interface DivisionContextEntry {
  id: string;
  branch_id: string;
  division_id: string;
  is_default: boolean;
  branch?: Branch;
  division?: Division;
}

export interface DivisionContextType {
  userContexts: DivisionContextEntry[];
  activeDivision: Division | null;
  activeBranch: Branch | null;
  setActiveDivisionId: (divisionId: string) => void;
  activeModelType: DivisionModelType | null;
  isLoading: boolean;
  switcherOptions: { id: string; label: string; divisionId: string; branchId: string; modelType: DivisionModelType }[];
}

export const DivisionContext = createContext<DivisionContextType | undefined>(undefined);
export const DIVISION_STORAGE_KEY = 'lms_active_division_id';
