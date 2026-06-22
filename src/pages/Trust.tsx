import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Lock, Database, Users, Mail, FileText, AlertCircle } from "lucide-react";

export default function Trust() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Trust &amp; Security</h1>
            <p className="text-sm text-muted-foreground">
              How Al Quran Time Academy protects your data
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <p className="text-sm text-muted-foreground">
          This page is maintained by Al Quran Time Academy to answer common security and
          privacy questions about our learning platform. It describes app-visible controls
          and our current practices. It is not an independent certification or audit
          attestation.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" /> Access &amp; Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Email &amp; password sign-in with optional Google sign-in.</p>
            <p>• Role-based access for students, parents, teachers, and administrators.</p>
            <p>• Parents access only their linked children; teachers access only their assigned students.</p>
            <p>• Server-side authorization on every protected endpoint.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" /> Platform &amp; Hosting
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• The application runs on Lovable Cloud, a managed backend platform with row-level security and managed Postgres.</p>
            <p>• Data is encrypted in transit (HTTPS/TLS) and at rest by the underlying managed database service.</p>
            <p>• Operational security of the underlying infrastructure is provided by the platform vendor; application-level controls are operated by Al Quran Time Academy.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" /> Data Collection &amp; Use
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• We collect only the information required to operate the academy: contact details, enrollment records, attendance, academic progress, and (where applicable) fee &amp; payout records.</p>
            <p>• Sensitive fields such as government ID and bank details are stored only when a user provides them and are limited to the account owner and authorised admin staff.</p>
            <p>• Personal data is never sold.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" /> Subprocessors &amp; Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Lovable Cloud (hosting, database, authentication, storage, edge functions).</p>
            <p>• Zoom (live classes), used only when a class is scheduled.</p>
            <p>• WhatsApp messaging provider (WhatsChimp), used for class &amp; fee reminders.</p>
            <p>• Additional integrations are added only when needed for academy operations.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" /> Retention &amp; Deletion
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Academic and financial records are retained as part of student history; this supports continuity of learning and audit requirements.</p>
            <p>• You can request review, correction, or deletion of personal data by contacting us at the address below. Some records (e.g. paid invoices) may be retained where required by law.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5" /> Reporting a Security Issue
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>If you believe you have found a security vulnerability or your data has been exposed, please contact us immediately so we can investigate.</p>
            <p className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4" />
              <a href="mailto:support@alqurantimeacademy.com" className="underline">
                support@alqurantimeacademy.com
              </a>
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground pt-4 border-t">
          This page is informational and reflects current controls visible in the application.
          It does not constitute a contract, warranty, or certification of compliance with any
          specific regulatory framework (such as GDPR, HIPAA, PCI-DSS, SOC&nbsp;2, or ISO&nbsp;27001).
          For formal agreements, please contact us directly.
        </p>
      </main>
    </div>
  );
}
