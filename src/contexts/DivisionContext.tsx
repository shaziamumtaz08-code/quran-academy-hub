import React, { useState, useEffect, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DivisionContext,
  DIVISION_STORAGE_KEY,
  type Branch,
  type Division,
  type DivisionContextEntry,
} from './DivisionContextObject';

export type { DivisionModelType, BranchType, Division, Branch, DivisionContextEntry } from './DivisionContextObject';

export function DivisionProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, isSuperAdmin } = useAuth();
  const [userContexts, setUserContexts] = useState<DivisionContextEntry[]>([]);
  const [activeDivisionId, setActiveDivisionIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DIVISION_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || authLoading) {
      setIsLoading(false);
      return;
    }

    const fetchContextData = async () => {
      setIsLoading(true);
      try {
        const [contextsRes, branchesRes, divisionsRes] = await Promise.all([
          supabase.from('user_context').select('*').eq('user_id', user.id),
          supabase.from('branches').select('*').eq('is_active', true),
          supabase.from('divisions').select('*').eq('is_active', true),
        ]);

        const ctxs = contextsRes.data || [];
        const brs = (branchesRes.data || []) as Branch[];
        const divs = (divisionsRes.data || []) as Division[];

        setBranches(brs);
        setDivisions(divs);

        let enriched: DivisionContextEntry[];
        if (isSuperAdmin) {
          enriched = divs.map(d => ({
            id: `sa-${d.id}`,
            branch_id: d.branch_id,
            division_id: d.id,
            is_default: d.id === (ctxs.find(c => c.is_default)?.division_id || divs[0]?.id),
            branch: brs.find(b => b.id === d.branch_id),
            division: d,
          }));
        } else {
          enriched = ctxs.map(ctx => ({
            ...ctx,
            branch: brs.find(b => b.id === ctx.branch_id),
            division: divs.find(d => d.id === ctx.division_id),
          })).filter(ctx => ctx.branch && ctx.division);
        }

        setUserContexts(enriched);

        if (enriched.length === 0) {
          setActiveDivisionIdState(null);
          localStorage.removeItem(DIVISION_STORAGE_KEY);
          return;
        }

        const hasAuthorizedStoredDivision = !!activeDivisionId && enriched.some(ctx => ctx.division_id === activeDivisionId);

        if (!hasAuthorizedStoredDivision) {
          const defaultCtx = enriched.find(c => c.is_default) || enriched[0];
          if (defaultCtx) {
            setActiveDivisionIdState(defaultCtx.division_id);
            localStorage.setItem(DIVISION_STORAGE_KEY, defaultCtx.division_id);
          }
        }
      } catch (err) {
        console.error('Error fetching division context:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContextData();
  }, [user?.id, authLoading, isSuperAdmin, activeDivisionId]);

  const setActiveDivisionId = (divisionId: string) => {
    setActiveDivisionIdState(divisionId);
    try {
      localStorage.setItem(DIVISION_STORAGE_KEY, divisionId);
    } catch {
      // Ignore storage errors
    }
  };

  const activeDivision = useMemo(() => {
    return divisions.find(d => d.id === activeDivisionId) || null;
  }, [divisions, activeDivisionId]);

  const activeBranch = useMemo(() => {
    if (!activeDivision) return null;
    return branches.find(b => b.id === activeDivision.branch_id) || null;
  }, [branches, activeDivision]);

  const activeModelType = activeDivision?.model_type || null;

  const switcherOptions = useMemo(() => {
    const seen = new Set<string>();
    return userContexts
      .filter(ctx => ctx.division && ctx.branch)
      .filter(ctx => {
        if (seen.has(ctx.division_id)) return false;
        seen.add(ctx.division_id);
        return true;
      })
      .map(ctx => ({
        id: ctx.id,
        label: `${ctx.branch!.name} — ${ctx.division!.name}`,
        divisionId: ctx.division_id,
        branchId: ctx.branch_id,
        modelType: ctx.division!.model_type,
      }));
  }, [userContexts]);

  return (
    <DivisionContext.Provider value={{
      userContexts,
      activeDivision,
      activeBranch,
      setActiveDivisionId,
      activeModelType,
      isLoading,
      switcherOptions,
    }}>
      {children}
    </DivisionContext.Provider>
  );
}
