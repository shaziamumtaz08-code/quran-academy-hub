import { RefreshCw, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const ROLE_HOME: Record<AppRole, string> = {
  super_admin: '/dashboard',
  admin: '/dashboard',
  admin_division: '/dashboard',
  admin_admissions: '/dashboard',
  admin_fees: '/dashboard',
  admin_academic: '/dashboard',
  teacher: '/dashboard',
  examiner: '/dashboard',
  student: '/dashboard',
  parent: '/parent',
};

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  admin_admissions: 'Admissions',
  admin_fees: 'Fees Admin',
  admin_academic: 'Academic',
  teacher: 'Teacher',
  examiner: 'Examiner',
  student: 'Student',
  parent: 'Parent',
};

export function RoleSwitcher() {
  const { profile, activeRole, setActiveRole } = useAuth();
  const navigate = useNavigate();

  if (!profile?.roles || profile.roles.length <= 1) {
    return null;
  }

  const currentLabel = activeRole ? ROLE_LABELS[activeRole] : 'Select Role';

  const handleSelect = (role: AppRole) => {
    setActiveRole(role);
    const home = ROLE_HOME[role] || '/dashboard';
    navigate(home, { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="gap-2 bg-[hsl(200,85%,55%)] hover:bg-[hsl(200,85%,45%)] text-white font-medium px-4"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLabel}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card border-border z-50">
        {profile.roles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => handleSelect(role)}
            className={activeRole === role ? 'bg-accent' : ''}
          >
            {ROLE_LABELS[role] || role.replace('_', ' ')}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
