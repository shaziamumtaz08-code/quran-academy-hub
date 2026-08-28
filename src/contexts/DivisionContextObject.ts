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

/**
 * Impersonation tabs keep their own active division in sessionStorage so they
 * neither read nor clobber the admin's own workspace selection.
 */
export const isImpersonationTab = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem('lovable_impersonation_tab') === '1';
  } catch {
    return false;
  }
};

export const divisionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return isImpersonationTab() ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
};

export const readStoredDivisionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    // The impersonation landing page passes the admin's active division as ?div=
    const fromUrl = new URLSearchParams(window.location.search).get('div');
    if (fromUrl) {
      divisionStorage()?.setItem(DIVISION_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return divisionStorage()?.getItem(DIVISION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
};
