import React from 'react';
import { useLocation } from 'react-router-dom';
import { useKidContext } from '@/contexts/KidContext';
import { Info } from 'lucide-react';

/**
 * Sticky banner shown to parents while operating in a child's portal,
 * making it clear that any messages/tickets/comments they post will
 * carry their (parent) identity.
 */
export function ActingAsBanner() {
  const { isParentActor, activeKid, kids, setActiveKidId, activeKidId } = useKidContext();
  const { pathname } = useLocation();
  // Hide on the Parent hub itself — no child is "active" there.
  const onParentHub = pathname === '/parent' || pathname === '/parent/' || pathname === '/dashboard';
  if (onParentHub) return null;
  if (!isParentActor || !activeKid) return null;

  return (
    <div className="bg-accent/10 border-b border-accent/20 px-3 py-2 flex items-center gap-2 text-[12px] text-foreground">
      <Info className="h-3.5 w-3.5 shrink-0 text-accent" />
      <span className="truncate">
        Acting as parent of <strong>{activeKid.full_name}</strong> — anything you post will be shown as <strong>(Parent)</strong>.
      </span>
      {kids.length > 1 && (
        <select
          value={activeKidId || ''}
          onChange={(e) => setActiveKidId(e.target.value)}
          className="ml-auto bg-background border border-border rounded-md px-2 py-0.5 text-[11px] font-medium"
        >
          {kids.map(k => (
            <option key={k.id} value={k.id}>{k.full_name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

/**
 * Inline badge to display next to an author's name when the row was
 * posted by a parent on behalf of a child.
 */
export function ActorBadge({ actorRole }: { actorRole?: string | null }) {
  if (actorRole !== 'parent') return null;
  return (
    <span className="ml-1 inline-flex items-center rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0 text-[10px] font-bold text-accent leading-[14px]">
      Parent
    </span>
  );
}
