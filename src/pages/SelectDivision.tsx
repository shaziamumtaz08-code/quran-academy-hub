import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, MapPin, Users, User, Building2, Wifi, ChevronRight, AlertTriangle, CalendarCheck, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoLight from '@/assets/logo-light.png';
import { useSuperAdminOverview } from '@/hooks/useSuperAdminOverview';
import { GlobalKpiStrip, buildKpis } from '@/components/superadmin/GlobalKpiStrip';
import { LiveClassesPanel } from '@/components/superadmin/LiveClassesPanel';
import { useAcademyTimezone, zonedClockLabel, zonedDateLabel } from '@/hooks/useAcademyTimezone';

const MODEL_CONFIG: Record<string, { icon: React.ElementType; gradient: string; tagline: string }> = {
  one_to_one: {
    icon: User,
    gradient: 'from-[hsl(216,70%,11%)] to-[hsl(216,60%,20%)]',
    tagline: 'Personalized Mentorship',
  },
  group: {
    icon: Users,
    gradient: 'from-[hsl(197,100%,45%)] to-[hsl(197,90%,35%)]',
    tagline: 'Batch Learning Model',
  },
};

const BRANCH_ICONS: Record<string, React.ElementType> = {
  online: Globe,
  onsite: MapPin,
};

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function SelectDivision() {
  const { profile, activeRole, isLoading: authLoading } = useAuth();
  const { setActiveDivisionId } = useDivision();
  const navigate = useNavigate();
  const { toast } = useToast();
  const tz = useAcademyTimezone();
  const { data, isLoading } = useSuperAdminOverview();

  // Role guard: only super_admin can access this page
  useEffect(() => {
    if (!authLoading && activeRole && activeRole !== 'super_admin') {
      toast({ title: 'Unauthorized access', description: 'Redirecting to your dashboard...', variant: 'destructive' });
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, activeRole, navigate, toast]);

  const divisions = data?.divisions || [];
  const metrics = data?.metrics || {};
  const kpis = useMemo(() => (divisions.length ? buildKpis(divisions, metrics) : []), [divisions, metrics]);
  const divisionNames = useMemo(
    () => Object.fromEntries(divisions.map((d) => [d.id, d.name])),
    [divisions],
  );

  const clock = zonedClockLabel(tz);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()));

  const handleSelect = (divisionId: string) => {
    setActiveDivisionId(divisionId);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoLight} alt="Al-Quran Time" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="font-serif text-lg font-bold text-foreground">Al-Quran Time Academy</h1>
              <p className="text-xs text-muted-foreground">Command Center</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">{activeRole?.replace(/_/g, ' ') || 'User'}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        {/* Greeting */}
        <div>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            {greeting(hour)}, {profile?.full_name?.split(' ')[0] || 'Admin'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {zonedDateLabel(tz)} · {clock} ({tz})
          </p>
        </div>

        {/* Global KPIs */}
        <GlobalKpiStrip items={kpis} loading={isLoading || authLoading} />

        {/* Live & Upcoming */}
        <LiveClassesPanel divisionNames={divisionNames} />

        {/* Division snapshots / workspace entry */}
        <section>
          <div className="mb-4">
            <h3 className="font-serif text-xl font-bold text-foreground">Divisions</h3>
            <p className="text-sm text-muted-foreground">
              Enter a workspace — each division is fully isolated with its own data, schedules and records.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {divisions.map((card) => {
                const config = MODEL_CONFIG[card.modelType] || MODEL_CONFIG.group;
                const BranchIcon = BRANCH_ICONS[card.branchType] || Globe;
                const ModelIcon = config.icon;
                const m = metrics[card.id];

                return (
                  <Card
                    key={card.id}
                    onClick={() => handleSelect(card.id)}
                    className="group relative cursor-pointer overflow-hidden border-0 shadow-card transition-all duration-300 hover:scale-[1.01] hover:shadow-card-hover"
                  >
                    <div className={`bg-gradient-to-r ${config.gradient} p-6 pb-8`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge className="mb-3 border-0 bg-white/20 text-xs font-medium text-white backdrop-blur-sm">
                            <BranchIcon className="mr-1 h-3 w-3" />
                            {card.branchName}
                          </Badge>
                          <h3 className="mb-1 font-serif text-xl font-bold text-white">{card.name}</h3>
                          <p className="text-sm text-white/70">{config.tagline}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                          <ModelIcon className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-card p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-6">
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-foreground">{m?.students ?? 0}</span>
                            <span className="text-muted-foreground">Students</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-foreground">{m?.teachers ?? 0}</span>
                            <span className="text-muted-foreground">Teachers</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-medium text-accent transition-transform group-hover:translate-x-1">
                          Enter
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Snapshot metrics */}
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
                          <CalendarCheck className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-bold text-foreground">
                            {m?.attendancePct === null || m === undefined ? '—' : `${m.attendancePct}%`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Attendance today</p>
                        </div>
                        <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
                          <Wallet className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-bold text-warning">{m?.overdueCount ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">Overdue fees</p>
                        </div>
                        <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
                          <AlertTriangle className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-bold text-destructive">{m?.alerts ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">Active alerts</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                        {card.branchType === 'online' ? (
                          <><Wifi className="h-3.5 w-3.5 text-accent" /><span className="text-xs text-muted-foreground">Online — Global Access</span></>
                        ) : (
                          <><Building2 className="h-3.5 w-3.5 text-warning" /><span className="text-xs text-muted-foreground">Physical Campus</span></>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">{m?.classesToday ?? 0} classes today</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <p className="pb-6 text-center text-xs text-muted-foreground">
          💡 You can switch workspaces anytime using the header dropdown
        </p>
      </main>
    </div>
  );
}
