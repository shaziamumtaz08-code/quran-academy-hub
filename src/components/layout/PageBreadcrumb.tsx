import { Link, useLocation, useSearchParams } from 'react-router-dom';
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
  '/exam-templates': 'Exam Templates',
  '/exam-submission': 'Submit Exam',
  '/exam-results': 'Exam Results',
  '/reports': 'Reports',
  '/payments': 'Payments',
  '/kpi': 'KPI',
  '/resources': 'Resources',
  '/lessons': 'Lessons',
};

export function PageBreadcrumb() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const pathname = location.pathname;
  const pageLabel = ROUTE_LABELS[pathname] || pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  // For Resources page, get folder/subfolder from URL params
  const folder = searchParams.get('folder');
  const subFolder = searchParams.get('subfolder');
  
  const isHome = pathname === '/dashboard';
  const isResources = pathname === '/resources';

  const handleHomeClick = () => {
    // Navigate handled by Link
  };

  const handlePageClick = () => {
    if (isResources) {
      // Clear folder filters when clicking "Resources"
      setSearchParams({});
    }
  };

  const handleFolderClick = () => {
    if (folder) {
      // Keep folder but clear subfolder
      setSearchParams({ folder });
    }
  };

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        {/* Home */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link 
              to="/dashboard" 
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
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
              {isResources && (folder || subFolder) ? (
                <BreadcrumbLink 
                  onClick={handlePageClick}
                  className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  {pageLabel}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}

        {/* Folder (for Resources) */}
        {isResources && folder && (
          <>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              {subFolder ? (
                <BreadcrumbLink 
                  onClick={handleFolderClick}
                  className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  {folder}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{folder}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}

        {/* Sub-folder (for Resources) */}
        {isResources && subFolder && (
          <>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{subFolder}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

