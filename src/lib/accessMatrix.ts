export type AppRole =
  | 'super_admin'
  | 'admin'            // legacy — retiring, keep for transition
  | 'admin_division'   // replaces admin — full division-scoped rights
  | 'admin_admissions'
  | 'admin_fees'
  | 'admin_academic'
  | 'teacher'
  | 'examiner'
  | 'student'
  | 'parent';

export type DivisionModel = 'one_to_one' | 'group' | 'recorded';
export type Capability = 'view' | 'create' | 'edit' | 'delete';

export interface ModuleAccess {
  id: string;
  route: string;
  roles: Partial<Record<AppRole, Capability[]>>;
  divisions?: DivisionModel[];
  tabs?: ModuleAccess[];
  group?: 'home' | 'teaching' | 'people' | 'finance' | 'reports' | 'communication' | 'settings';
  mobile?: AppRole[];
}

const ADMIN_ROLES: AppRole[] = ['super_admin','admin','admin_division','admin_admissions','admin_fees','admin_academic'];
const ADMIN_FULL: Capability[] = ['view','create','edit','delete'];
const VIEW_ONLY: Capability[] = ['view'];

const adminFull = Object.fromEntries(ADMIN_ROLES.map(r => [r, ADMIN_FULL])) as Partial<Record<AppRole,Capability[]>>;

export const ACCESS_MATRIX: ModuleAccess[] = [
  { id:'dashboard',           route:'/dashboard',              roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, student:VIEW_ONLY, parent:VIEW_ONLY}, group:'home', mobile:['super_admin','admin_division','teacher','student','parent'] },
  { id:'admin_command',       route:'/admin',                  roles:{...adminFull}, group:'home' },
  { id:'select_division',     route:'/select-division',        roles:{super_admin:VIEW_ONLY} },
  { id:'teaching_landing',    route:'/teaching',               roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY}, group:'teaching' },
  { id:'teaching_os',         route:'/teaching-os',            roles:{...adminFull, teacher:['view','create','edit'], examiner:VIEW_ONLY}, divisions:['group','recorded'], group:'teaching' },
  { id:'teacher_nazra',       route:'/teacher',                roles:{teacher:VIEW_ONLY}, divisions:['one_to_one'], group:'teaching' },
  { id:'courses_admin',       route:'/courses',                roles:{...adminFull}, group:'teaching' },
  { id:'my_courses',          route:'/my-courses',             roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, student:VIEW_ONLY, parent:VIEW_ONLY}, group:'teaching' },
  { id:'my_teaching',         route:'/my-teaching/:courseId',  roles:{teacher:['view','create','edit']}, group:'teaching' },
  { id:'lessons',             route:'/lessons',                roles:{...adminFull, teacher:['view','create']}, group:'teaching' },
  { id:'assignments',         route:'/assignments',            roles:{...adminFull, teacher:['view','create','edit']}, group:'teaching' },
  { id:'subjects',            route:'/subjects',               roles:{...adminFull}, group:'teaching' },
  { id:'schedules',           route:'/schedules',              roles:{...adminFull}, group:'teaching' },
  { id:'my_schedule',         route:'/my-schedule',            roles:{teacher:VIEW_ONLY, examiner:VIEW_ONLY}, group:'teaching', mobile:['teacher'] },
  { id:'attendance',          route:'/attendance',             roles:{...adminFull, teacher:['view','create','edit'], examiner:VIEW_ONLY}, group:'teaching' },
  { id:'monthly_planning',    route:'/monthly-planning',       roles:{...adminFull, teacher:['view','create','edit']}, group:'teaching' },
  { id:'quiz_engine',         route:'/quiz-engine',            roles:{...adminFull, teacher:['view','create','edit']}, group:'teaching' },
  { id:'my_quizzes',          route:'/my-quizzes',             roles:{...adminFull, teacher:VIEW_ONLY, student:VIEW_ONLY}, group:'teaching' },
  { id:'people',              route:'/people',                 roles:{...adminFull}, group:'people' },
  { id:'students',            route:'/students',               roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, parent:VIEW_ONLY}, group:'people' },
  { id:'teachers',            route:'/teachers',               roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY}, group:'people' },
  { id:'user_management',     route:'/user-management',        roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL}, group:'people' },
  { id:'leads',               route:'/leads',                  roles:{...adminFull}, divisions:['one_to_one'], group:'people' },
  { id:'identity',            route:'/identity',               roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL}, group:'people' },
  { id:'finance',             route:'/finance',                roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL, admin_fees:ADMIN_FULL, admin_academic:VIEW_ONLY, admin_admissions:VIEW_ONLY}, group:'finance' },
  { id:'finance_setup',       route:'/finance-setup',          roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL, admin_fees:ADMIN_FULL}, group:'finance' },
  { id:'salary',              route:'/salary',                 roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL, admin_fees:ADMIN_FULL, teacher:VIEW_ONLY}, group:'finance' },
  { id:'staff_salaries',      route:'/staff-salaries',         roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL, admin_fees:ADMIN_FULL}, group:'finance' },
  { id:'expenses',            route:'/expenses',               roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL, admin_fees:ADMIN_FULL}, group:'finance' },
  { id:'cash_advances',       route:'/cash-advances',          roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL, admin_fees:ADMIN_FULL}, group:'finance' },
  { id:'reports',             route:'/reports',                roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL, admin_academic:VIEW_ONLY, admin_fees:VIEW_ONLY, admin_admissions:VIEW_ONLY}, group:'reports' },
  { id:'kpi',                 route:'/kpi',                    roles:{...adminFull}, group:'reports' },
  { id:'student_reports',     route:'/student-reports',        roles:{...adminFull, teacher:VIEW_ONLY, examiner:['view','create','edit'], student:VIEW_ONLY, parent:VIEW_ONLY}, group:'reports' },
  { id:'report_card_tpl',     route:'/report-card-templates',  roles:{...adminFull, examiner:ADMIN_FULL}, group:'reports' },
  { id:'generate_report_card',route:'/generate-report-card',   roles:{...adminFull, examiner:['view','create']}, group:'reports' },
  { id:'communication',       route:'/communication',          roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, student:VIEW_ONLY, parent:VIEW_ONLY}, group:'communication', mobile:['super_admin','admin_division','teacher','student','parent','examiner'] },
  { id:'chat',                route:'/chat',                   roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, student:VIEW_ONLY, parent:VIEW_ONLY}, group:'communication' },
  { id:'whatsapp',            route:'/whatsapp',               roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL}, group:'communication' },
  { id:'notifications',       route:'/notifications',          roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, student:VIEW_ONLY, parent:VIEW_ONLY}, group:'communication' },
  { id:'zoom_management',     route:'/zoom-management',        roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL}, group:'settings' },
  { id:'work_hub',            route:'/work-hub',               roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, student:VIEW_ONLY, parent:VIEW_ONLY}, group:'communication' },
  { id:'resources',           route:'/resources',              roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, student:VIEW_ONLY}, group:'teaching' },
  { id:'settings',            route:'/settings',               roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL}, group:'settings' },
  { id:'org_settings',        route:'/organization-settings',  roles:{super_admin:ADMIN_FULL}, group:'settings' },
  { id:'integrity_audit',     route:'/integrity-audit',        roles:{super_admin:ADMIN_FULL, admin:ADMIN_FULL, admin_division:ADMIN_FULL}, group:'settings' },
  { id:'schema_explorer',     route:'/admin/schema-explorer',  roles:{super_admin:ADMIN_FULL} },
  { id:'parent_portal',       route:'/parent',                 roles:{super_admin:VIEW_ONLY, admin:VIEW_ONLY, admin_division:VIEW_ONLY, parent:VIEW_ONLY}, mobile:['parent'] },
  { id:'connections',         route:'/connections/:type/:id',  roles:{...adminFull, teacher:VIEW_ONLY, student:VIEW_ONLY, parent:VIEW_ONLY} },
  { id:'classroom',           route:'/classroom/:sessionId',   roles:{...adminFull, teacher:VIEW_ONLY, examiner:VIEW_ONLY, student:VIEW_ONLY} },
];

// ── Helpers ──────────────────────────────────────────────
export const isAdminRole = (role: AppRole): boolean =>
  ['super_admin','admin','admin_division','admin_admissions','admin_fees','admin_academic'].includes(role);

export const can = (role: AppRole, moduleId: string, cap: Capability): boolean => {
  const mod = ACCESS_MATRIX.find(m => m.id === moduleId);
  return mod?.roles[role]?.includes(cap) ?? false;
};

export const visibleNavFor = (role: AppRole, model: DivisionModel): ModuleAccess[] =>
  ACCESS_MATRIX.filter(m =>
    (m.roles[role]?.length ?? 0) > 0 &&
    (!m.divisions || m.divisions.includes(model))
  );

export const mobileNavFor = (role: AppRole, model: DivisionModel): ModuleAccess[] =>
  visibleNavFor(role, model).filter(m => m.mobile?.includes(role));
