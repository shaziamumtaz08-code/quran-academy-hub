import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DuplicateFlagBadgeProps {
  userId: string;
  reason: string | null;
  flaggedAt: string | null;
  reviewedAt: string | null;
  onReviewed?: () => void;
}

/**
 * "Possible duplicate — check" signal raised when a registration reuses a phone
 * number that already exists under a different email. Never auto-merges: an
 * admin confirms it is a different person and clears the flag.
 */
export function DuplicateFlagBadge({ userId, reason, flaggedAt, reviewedAt, onReviewed }: DuplicateFlagBadgeProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!flaggedAt || reviewedAt) return null;

  const clearFlag = async () => {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        duplicate_reviewed_at: new Date().toISOString(),
        duplicate_reviewed_by: auth?.user?.id ?? null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not clear flag", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as reviewed" });
    setOpen(false);
    onReviewed?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="w-fit cursor-pointer gap-1 border-orange-300 bg-orange-500/10 text-[10px] text-orange-700"
        >
          <AlertTriangle className="h-3 w-3" />
          Possible duplicate — check
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="text-xs text-muted-foreground">
          {reason || "Shares contact details with an existing profile, but uses a different email."}
        </p>
        <p className="text-xs text-muted-foreground">
          Profiles are never merged automatically. Confirm whether this is a genuine second person.
        </p>
        <Button size="sm" className="w-full" disabled={saving} onClick={clearFlag}>
          {saving ? "Saving..." : "Not a duplicate — clear flag"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
