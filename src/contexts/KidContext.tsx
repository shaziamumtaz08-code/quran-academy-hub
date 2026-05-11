import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface KidOption {
  id: string;
  full_name: string;
}

interface KidContextValue {
  /** All accessible kids (parents: linked children; students: just self). */
  kids: KidOption[];
  /** Currently selected kid (or self for student role). */
  activeKidId: string | null;
  activeKid: KidOption | null;
  /** True when the actor is a parent operating on a child's portal. */
  isParentActor: boolean;
  /** Stable role label for stamping writes. */
  actorRole: 'parent' | 'student' | null;
  setActiveKidId: (id: string) => void;
  isLoading: boolean;
}

const KidContext = createContext<KidContextValue | undefined>(undefined);

const STORAGE_KEY = 'active_kid_id';

export function KidContextProvider({ children }: { children: React.ReactNode }) {
  const { user, activeRole } = useAuth();
  const [activeKidId, setActiveKidIdState] = useState<string | null>(null);

  const isParentRole = activeRole === 'parent';
  const isStudentRole = activeRole === 'student';

  const { data: kids = [], isLoading } = useQuery({
    queryKey: ['kid-context-kids', user?.id, activeRole],
    queryFn: async (): Promise<KidOption[]> => {
      if (!user?.id) return [];
      if (isStudentRole) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', user.id)
          .single();
        return data ? [{ id: data.id, full_name: data.full_name || 'You' }] : [];
      }
      if (isParentRole) {
        const { data } = await supabase
          .from('student_parent_links')
          .select('student_id, student:profiles!student_parent_links_student_id_fkey(id, full_name)')
          .eq('parent_id', user.id);
        return (data || [])
          .map((r: any) => r.student ? { id: r.student.id, full_name: r.student.full_name || 'Child' } : null)
          .filter(Boolean) as KidOption[];
      }
      return [];
    },
    enabled: !!user?.id && (isParentRole || isStudentRole),
  });

  // Hydrate from storage / first kid.
  useEffect(() => {
    if (!kids.length) { setActiveKidIdState(null); return; }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && kids.some(k => k.id === stored)) {
      setActiveKidIdState(stored);
    } else {
      setActiveKidIdState(kids[0].id);
    }
  }, [kids]);

  const setActiveKidId = useCallback((id: string) => {
    setActiveKidIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeKid = kids.find(k => k.id === activeKidId) || null;
  const actorRole: 'parent' | 'student' | null =
    isParentRole ? 'parent' : isStudentRole ? 'student' : null;

  const value: KidContextValue = {
    kids,
    activeKidId,
    activeKid,
    isParentActor: isParentRole && !!activeKid && activeKid.id !== user?.id,
    actorRole,
    setActiveKidId,
    isLoading,
  };

  return <KidContext.Provider value={value}>{children}</KidContext.Provider>;
}

export function useKidContext() {
  const ctx = useContext(KidContext);
  if (!ctx) {
    // Soft fallback for trees outside provider
    return {
      kids: [], activeKidId: null, activeKid: null,
      isParentActor: false, actorRole: null,
      setActiveKidId: () => {}, isLoading: false,
    } as KidContextValue;
  }
  return ctx;
}

/**
 * Returns provenance fields to attach to any "write" performed inside a
 * student/parent portal. Apply via spread when inserting:
 *   await supabase.from('chat_messages').insert({ ...payload, ...stamp })
 */
export function useActorStamp(): { actor_role: string | null; acted_for_student_id: string | null } {
  const { actorRole, activeKidId } = useKidContext();
  return {
    actor_role: actorRole,
    acted_for_student_id: actorRole ? activeKidId : null,
  };
}
