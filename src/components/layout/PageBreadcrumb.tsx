import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const MODULE_DEFAULTS: Record<string, string> = {
  '/dashboard': '/dashboard',
  '/teaching': '/teaching?view=assignments',
  '/people': '/people?view=students',
  '/finance': '/finance?view=invoices',
  '/reports': '/reports?view=executive',
  '/communication': '/communication?view=academy-chat',
  '/settings': '/settings?view=organization',
  '/work-hub': '/work-hub',
};

const MODULE_LABELS: Record<string, string> = {
  '/dashboard': 'Home',
  '/teaching': 'Teaching',
  '/people': 'People',
  '/finance': 'Finance',
  '/reports': 'Reports',
  '/communication': 'Communication',
  '/settings': 'Settings',
  '/work-hub': 'Work Hub',
};

const VIEW_LABELS: Record<string, string> = {
  'live-classes': 'Live Classes',
  assignments: 'Assignments',
  schedules: 'Schedules',
  attendance: 'Attendance',
  planning: 'Planning',
  subjects: 'Subjects',
  'one-to-one': '1-to-1 Assignments',
  students: 'Students',
  teachers: 'Teachers',
  staff: 'Staff',
  parents: 'Parents',
  leads: 'Leads',
  invoices: 'Invoices',
  payments: 'Payments',
  'fee-plans': 'Fee Plans',
  salaries: 'Salaries',
  expenses: 'Expenses',
  'cash-advances': 'Cash Advances',
  payouts: 'Payouts',
  setup: 'Setup',
  executive: 'Executive Dashboard',
  fees: 'Fee & Financial',
  engagement: 'Student Engagement',
  accountability: 'Accountability',
  'course-batch': 'Course / Batch',
  'activity-logs': 'Activity Logs',
  alerts: 'Alerts & Automation',
  custom: 'Custom Report Builder',
  'academy-chat': 'Academy Chat',
  chat: 'Academy Chat',
  whatsapp: 'WhatsApp Inbox',
  notifications: 'Notifications',
  zoom: 'Zoom',
  organization: 'Organization',
  branches: 'Branches',
  divisions: 'Divisions',
  holidays: 'Holidays',
  'payouts-config': 'Payouts Config',
  classroom: 'Classroom',
  'finance-setup': 'Finance Setup',
  'teaching-config': 'Teaching Config',
  resources: 'Resources Manager',
  integrity: 'Integrity Audit',
  schema: 'Schema Explorer',
};

export function PageBreadcrumb() {
  const location = useLocation();
  const pathname = location.pathname;
  const params = new URLSearchParams(location.search);
  const view = params.get('view') || params.get('section');

  const moduleLabel = MODULE_LABELS[pathname] || pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const moduleHref = MODULE_DEFAULTS[pathname] || pathname;
  const currentLabel = pathname === '/work-hub'
    ? 'Work Hub'
    : view
      ? VIEW_LABELS[view] || view.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      : moduleLabel;

  return (
    <div className="mb-4">
      <Breadcrumb>
        <BreadcrumbList className="flex-wrap">
          <BreadcrumbItem>
            {pathname === '/dashboard' ? (
              <BreadcrumbPage className="font-medium text-foreground">Home</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link to="/dashboard" className="font-medium text-muted-foreground transition-colors hover:text-foreground">Home</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>

          {pathname !== '/dashboard' ? (
            <>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </BreadcrumbSeparator>

              {pathname !== '/work-hub' ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={moduleHref} className="font-medium text-muted-foreground transition-colors hover:text-foreground">
                        {moduleLabel}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>

                  {view ? (
                    <>
                      <BreadcrumbSeparator>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </BreadcrumbSeparator>
                      <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">{currentLabel}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  ) : null}
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground">Work Hub</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
