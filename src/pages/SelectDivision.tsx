import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, MapPin, Users, User, Building2, Wifi, ChevronRight } from 'lucide-react';
import logoLight from '@/assets/logo-light.png';

interface DivisionCard {
  divisionId: string;
  divisionName: string;
  branchName: string;
  branchType: string;
  modelType: string;
  studentCount: number;
  teacherCount: number;
}

const MODEL_CONFIG: Record<string, { icon: React.ElementType; gradient: string; badge: string; tagline: string }> = {
  one_to_one: {
    icon: User,
    gradient: 'from-[hsl(216,70%,11%)] to-[hsl(216,60%,20%)]',
    badge: 'Private 1:1',
    tagline: 'Personalized Mentorship',
  },
  group: {
    icon: Users,
    gradient: 'from-[hsl(197,100%,45%)] to-[hsl(197,90%,35%)]',
    badge: 'Group Academy',
    tagline: 'Batch Learning Model',
  },
};

const BRANCH_ICONS: Record<string, React.ElementType> = {
  online: Globe,
  onsite: MapPin,
};

export default function SelectDivision() {
  const { profile, isLoading: authLoading } = useAuth();
  const { setActiveDivisionId } = useDivision();
  const navigate = useNavigate();
  const [cards, setCards] = useState<DivisionCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDivisions = async () => {
      setLoading(true);
      const { data: divisions } = await supabase
        .from('divisions')
        .select('id, name, model_type, branch_id')
        .eq('is_active', true);

      const { data: branches } = await supabase
        .from('branches')
        .select('id, name, type')
        .eq('is_active', true);

      if (!divisions || !branches) {
        setLoading(false);
        return;
      }

      const branchMap = new Map(branches.map(b => [b.id, b]));

      const enriched: DivisionCard[] = divisions.map(d => {
        const branch = branchMap.get(d.branch_id);
        return {
          divisionId: d.id,
          divisionName: d.name,
          branchName: branch?.name || 'Unknown',
          branchType: branch?.type || 'online',
          modelType: d.model_type,
          studentCount: 0,
          teacherCount: 0,
        };
      });

      // Fetch counts per division
      const { data: assignmentCounts } = await supabase
        .from('student_teacher_assignments')
        .select('division_id, student_id, teacher_id')
        .eq('status', 'active');

      if (assignmentCounts) {
        for (const card of enriched) {
          const divAssignments = assignmentCounts.filter(a => a.division_id === card.divisionId);
          card.studentCount = new Set(divAssignments.map(a => a.student_id)).size;
          card.teacherCount = new Set(divAssignments.map(a => a.teacher_id)).size;
        }
      }

      setCards(enriched);
      setLoading(false);
    };

    fetchDivisions();
  }, []);

  const handleSelect = (divisionId: string) => {
    setActiveDivisionId(divisionId);
    navigate('/dashboard');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background islamic-pattern flex items-center justify-center">
        <div className="text-center">
          <img src={logoLight} alt="Al-Quran Time" className="h-20 w-20 object-contain mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
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
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl font-bold text-foreground mb-2">
            Select Your Workspace
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Choose a division to enter. Each workspace is fully isolated with its own data, schedules, and student records.
          </p>
        </div>

        {/* Division Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => {
            const config = MODEL_CONFIG[card.modelType] || MODEL_CONFIG.group;
            const BranchIcon = BRANCH_ICONS[card.branchType] || Globe;
            const ModelIcon = config.icon;

            return (
              <Card
                key={card.divisionId}
                onClick={() => handleSelect(card.divisionId)}
                className="group relative overflow-hidden border-0 shadow-card cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02]"
              >
                {/* Gradient Header */}
                <div className={`bg-gradient-to-r ${config.gradient} p-6 pb-8`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge className="bg-white/20 text-white border-0 mb-3 text-xs font-medium backdrop-blur-sm">
                        <BranchIcon className="h-3 w-3 mr-1" />
                        {card.branchName}
                      </Badge>
                      <h3 className="text-xl font-serif font-bold text-white mb-1">
                        {card.divisionName}
                      </h3>
                      <p className="text-white/70 text-sm">{config.tagline}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <ModelIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

                {/* Stats Footer */}
                <div className="p-5 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{card.studentCount}</span>
                        <span className="text-muted-foreground">Students</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{card.teacherCount}</span>
                        <span className="text-muted-foreground">Teachers</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-medium text-accent group-hover:translate-x-1 transition-transform">
                      Enter
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  
                  {/* Connection indicator */}
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  {card.branchType === 'online' ? (
                      <><Wifi className="h-3.5 w-3.5 text-accent" /><span className="text-xs text-muted-foreground">Online — Global Access</span></>
                    ) : (
                      <><Building2 className="h-3.5 w-3.5 text-warning" /><span className="text-xs text-muted-foreground">Physical Campus</span></>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Quick tip */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            💡 You can switch workspaces anytime using the header dropdown
          </p>
        </div>
      </main>
    </div>
  );
}
