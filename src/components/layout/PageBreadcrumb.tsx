import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Route to label mapping
const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/user-management': 'User Management',
  '/teachers': 'Teachers',
  '/students': 'Students',
  '/schedules': 'Schedules',
  '/attendance': 'Attendance',
  '/report-card-templates': 'Exam Report Template',
  '/generate-report-card': 'Generate Exam Report',
  '/student-reports': 'Student Exam Reports',
  '/reports': 'Reports',
  '/payments': 'Payments',
  '/kpi': 'KPI',
  '/resources': 'Resources',
  '/lessons': 'Lessons',
  '/monthly-planning': 'Monthly Planning',
  '/assignments': 'Assignments',
  '/subjects': 'Subjects',
};

export function PageBreadcrumb() {
  const location = useLocation();
  
  const pathname = location.pathname;
  const pageLabel = ROUTE_LABELS[pathname] || pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  const isHome = pathname === '/dashboard';
  const isResources = pathname === '/resources';
  const isCourseDetail = /^\/courses\/[^/]+$/.test(pathname) || /^\/academics\/courses\/[^/]+$/.test(pathname);

  // Resources has its own Drive-style breadcrumb, don't show duplicate
  // Dashboard home is redundant — each role dashboard has its own header
  // Course detail uses sidebar nav — breadcrumb would show raw UUID
  if (isResources || isHome || isCourseDetail) {
    return null;
  }

  return (
    <div className="mb-6 flex items-center gap-3 sticky top-0 z-10 bg-[hsl(var(--lms-surface,220_14%_96%))] py-2 -mt-2">
      {/* Back to Home Button */}
      <Link 
        to="/dashboard"
        className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        title="Go to Home"
      >
        <Home className="h-4 w-4" />
      </Link>

      {/* Breadcrumb Trail */}
      <Breadcrumb className="flex-1">
        <BreadcrumbList className="flex-wrap">
          {/* Home */}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link 
                to="/dashboard" 
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Home
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {/* Current page (if not home) */}
          {!isHome && (
            <>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-foreground">{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
