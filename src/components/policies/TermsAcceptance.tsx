import { FileText, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  openPolicyDocument,
  usePolicyDocuments,
  type PolicyDocument,
} from "@/components/policies/PolicyLibrary";

interface TermsAcceptanceProps {
  audience: "student" | "teacher" | "parent";
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}

/**
 * Terms & conditions block used on the public registration forms.
 * Lists the live policy documents (so applicants can read them before
 * accepting) plus a required acceptance checkbox.
 */
export function TermsAcceptance({ audience, checked, onChange, label }: TermsAcceptanceProps) {
  const { data: docs = [] } = usePolicyDocuments(audience);

  return (
    <div className="sm:col-span-2 space-y-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-accent" />
        Terms, policies &amp; agreements
      </div>

      {docs.length > 0 && (
        <ul className="space-y-1.5">
          {docs.map((doc: PolicyDocument) => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => openPolicyDocument(doc)}
                className="inline-flex items-center gap-2 text-sm text-accent underline-offset-4 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {doc.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-foreground">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onChange(Boolean(value))}
          className="mt-0.5"
        />
        <span>
          {label ??
            "I have read and accept the academy's terms and conditions, contract, learning agreement, attendance policy and privacy policy."}
          <span className="ml-1 text-accent">*</span>
        </span>
      </label>

      <p className="text-xs text-muted-foreground">
        You can review all documents any time at{" "}
        <a href={`/legal/policies?for=${audience}`} target="_blank" rel="noreferrer" className="underline">
          /legal/policies

        </a>
        .
      </p>
    </div>
  );
}

export const ACCEPTANCE_TEXT =
  "Accepted the academy terms & conditions, contract, learning agreement, attendance and privacy policies during registration.";

/** Writes an audit row per policy document the applicant accepted. */
export async function recordPolicyAcceptance(params: {
  audience: "student" | "teacher" | "parent";
  name: string;
  email: string;
}) {
  const { data } = await supabase
    .from("policy_documents")
    .select("id,version,audience")
    .eq("is_active", true);
  const docs = (data ?? []).filter(
    (doc: any) => doc.audience?.includes("all") || doc.audience?.includes(params.audience),
  );
  const rows = (docs.length ? docs : [{ id: null, version: null }]).map((doc: any) => ({
    applicant_name: params.name || null,
    applicant_email: params.email || null,
    role_context: params.audience,
    document_id: doc.id,
    document_version: doc.version,
    acceptance_text: ACCEPTANCE_TEXT,
    source_url: window.location.href,
  }));
  await supabase.from("policy_acceptances").insert(rows);
}
