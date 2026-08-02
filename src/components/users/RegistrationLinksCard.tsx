import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, GraduationCap, Users, Sparkles, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LinkDef {
  key: string;
  label: string;
  hint: string;
  path: string;
  icon: React.ElementType;
  tone: string;
}

const LINKS: LinkDef[] = [
  {
    key: 'student',
    label: 'Add student',
    hint: 'One or more children, one form',
    path: '/register/student',
    icon: GraduationCap,
    tone: 'from-sky-500 to-cyan-500 shadow-sky-500/30',
  },
  {
    key: 'teacher',
    label: 'Add teacher',
    hint: 'Teacher application & profile',
    path: '/register/teacher',
    icon: Users,
    tone: 'from-violet-500 to-fuchsia-500 shadow-violet-500/30',
  },
  {
    key: 'inquiry',
    label: 'New enquiry',
    hint: 'Demo request — creates a lead',
    path: '/inquiry',
    icon: Sparkles,
    tone: 'from-amber-500 to-orange-500 shadow-amber-500/30',
  },
];

/** Sleek launcher: click to open the public form, or copy the link to share. */
export function RegistrationLinksCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (event: React.MouseEvent, item: LinkDef) => {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}${item.path}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(item.key);
    window.setTimeout(() => setCopied(c => (c === item.key ? null : c)), 1800);
    toast({ title: 'Link copied', description: url });
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {LINKS.map(item => (
        <a
          key={item.key}
          href={item.path}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'group relative flex items-center gap-3 rounded-full bg-gradient-to-r px-4 py-2 pr-2 text-white',
            'shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl',
            item.tone,
          )}
        >
          <item.icon className="h-4 w-4 shrink-0 opacity-90 transition-transform group-hover:scale-110" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="block text-[10px] font-medium uppercase tracking-wide text-white/75">{item.hint}</span>
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-80" />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Copy ${item.label} link`}
            onClick={event => copy(event, item)}
            className="h-7 w-7 shrink-0 rounded-full bg-white/20 text-white hover:bg-white/35 hover:text-white"
          >
            {copied === item.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </a>
      ))}
    </div>
  );
}
