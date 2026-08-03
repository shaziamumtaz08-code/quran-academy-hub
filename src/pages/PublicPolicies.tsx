import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PolicyLibrary } from "@/components/policies/PolicyLibrary";

/**
 * Public-facing policy centre so applicants can read the terms they accept
 * on the registration forms before signing up.
 */
export default function PublicPolicies() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Al Quran Time Academy — Policies &amp; Terms
            </h1>
            <p className="text-xs text-muted-foreground">
              Contracts, learning agreements and academy policies for students, parents and teachers.
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <PolicyLibrary />
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
