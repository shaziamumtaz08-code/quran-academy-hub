import { useAuth } from "@/contexts/AuthContext";
import { PolicyLibrary } from "@/components/policies/PolicyLibrary";
import { ShieldCheck } from "lucide-react";

/**
 * Policies, SOPs and agreements — visible to every signed-in role.
 * Admins can publish new documents from the same screen.
 */
export default function Policies() {
  const { profile, activeRole } = useAuth();
  const role = activeRole || profile?.role || profile?.roles?.[0] || "student";
  const canManage = role === "admin" || role === "super_admin";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Policies &amp; SOPs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Academy contracts, learning agreements, standard operating procedures and
              guidelines — always the current published version.
            </p>
          </div>
        </div>
      </header>

      <PolicyLibrary audience={role} canManage={canManage} />
    </div>
  );
}
