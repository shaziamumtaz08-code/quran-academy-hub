import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link2, Copy, Check, Users, GraduationCap, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LinkDef {
  key: string;
  label: string;
  hint: string;
  path: string;
  icon: React.ElementType;
}

const LINKS: LinkDef[] = [
  {
    key: 'family',
    label: 'New student / family registration',
    hint: 'Share with a brand-new family. One form covers the parent and all their children. Lands in Registrations for admin review.',
    path: '/register/family',
    icon: Users,
  },
  {
    key: 'inquiry',
    label: 'New enquiry (lead) form',
    hint: 'Public enquiry form for demo requests. Creates a lead, not a user.',
    path: '/inquiry',
    icon: GraduationCap,
  },
];

/**
 * Registration links panel for User Management.
 * Generic links are for people who do NOT exist in the LMS yet.
 * Per-person links (row actions) are profile-completion links for existing records.
 */
export function RegistrationLinksCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (item: LinkDef) => {
    const url = `${window.location.origin}${item.path}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(item.key);
    window.setTimeout(() => setCopied((c) => (c === item.key ? null : c)), 1800);
    toast({ title: 'Link copied', description: url });
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Registration links</h3>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {LINKS.map((item) => (
            <div
              key={item.key}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
            >
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                  {window.location.origin}{item.path}
                </p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(item)}>
                {copied === item.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Already in the system? Use the <span className="font-medium text-foreground">chain icon</span> on that
            person's row below to copy their personal <span className="font-medium text-foreground">profile-completion
            link</span>. It opens their existing record with details pre-filled, so they only fill what's missing —
            no duplicate profile is created, and the record is updated in place.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
