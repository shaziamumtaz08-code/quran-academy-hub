import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssignRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    email?: string | null;
    roles?: AppRole[];
  } | null;
}

const ROLE_LABELS: Partial<Record<AppRole, string>> = {
  student: "Student",
  teacher: "Teacher",
  examiner: "Examiner",
  parent: "Parent",
  admin_division: "Division Admin",
  super_admin: "Super Admin",
};

export function AssignRoleDialog({ open, onOpenChange, user }: AssignRoleDialogProps) {
  const { session, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = activeRole === "super_admin";

  const [selectedRole, setSelectedRole] = useState<AppRole>("student");
  const [divisionId, setDivisionId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSelectedRole("student");
      setDivisionId("");
      setBranchId("");
    }
  }, [open, user?.id]);

  const { data: divisions = [] } = useQuery({
    queryKey: ["assign-role-divisions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("divisions")
        .select("id, name, branch_id, model_type")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["assign-role-branches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("branches")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  // Auto-fill branch when a division is selected
  useEffect(() => {
    if (selectedRole === "admin_division" && divisionId) {
      const div = divisions.find((d) => d.id === divisionId);
      if (div?.branch_id) setBranchId(div.branch_id);
    }
  }, [divisionId, selectedRole, divisions]);

  const availableRoles: AppRole[] = useMemo(() => {
    const base: AppRole[] = ["student", "teacher", "examiner", "parent", "admin_division"];
    if (isSuperAdmin) base.push("super_admin");
    return base;
  }, [isSuperAdmin]);

  const removeRoleMutation = useMutation({
    mutationFn: async (role: AppRole) => {
      if (!session?.access_token || !user) throw new Error("Authentication required");
      const { data, error } = await supabase.functions.invoke("remove-role", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId: user.id, role },
      });
      if (error) throw new Error(error.message || "Failed to remove role");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Role removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user selected");
      const payload: Record<string, unknown> = {
        addRoleOnly: true,
        existingUserId: user.id,
        email: user.email || "placeholder@example.com",
        fullName: user.full_name,
        role: selectedRole,
      };
      if (selectedRole === "admin_division") {
        if (!divisionId || !branchId) throw new Error("Division and branch are required for Division Admin");
        payload.division_id = divisionId;
        payload.branch_id = branchId;
      }
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: payload,
      });
      if (error) {
        let msg = error.message || "Failed to assign role";
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const b = await ctx.json();
            if (b?.error) msg = b.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success(`Assigned ${ROLE_LABELS[selectedRole] || selectedRole} role`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;

  const currentRoles = user.roles || [];
  const needsDivision = selectedRole === "admin_division";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Role to {user.full_name}</DialogTitle>
          <DialogDescription>
            Manage roles for this user. Each role grants different access scopes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {currentRoles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Current Roles</Label>
              <div className="flex flex-wrap gap-2">
                {currentRoles.map((r) => (
                  <Badge key={r} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                    {ROLE_LABELS[r] || r}
                    <button
                      type="button"
                      onClick={() => removeRoleMutation.mutate(r)}
                      disabled={removeRoleMutation.isPending}
                      className="ml-1 rounded-sm p-0.5 hover:bg-background/60"
                      aria-label={`Remove ${r} role`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Add Role</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsDivision && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Division *</Label>
                  <Select value={divisionId} onValueChange={setDivisionId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Branch *</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}{b.code ? ` (${b.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ℹ️ Division Admin has full rights scoped to selected division only.
              </p>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                assignMutation.isPending ||
                (needsDivision && (!divisionId || !branchId))
              }
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Assigning…</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" />Assign Role</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
