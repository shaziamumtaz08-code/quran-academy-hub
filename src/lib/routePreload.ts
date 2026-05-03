const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/admin": () => import("@/pages/AdminCommandCenter"),
  "/communication": () => import("@/pages/CommunicationLanding"),
  "/course-asset-library": () => import("@/pages/CourseAssetLibrary"),
  "/courses": () => import("@/pages/Courses"),
  "/dashboard": () => import("@/pages/Dashboard"),
  "/finance": () => import("@/pages/FinanceLanding"),
  "/my-courses": () => import("@/pages/MyCourses"),
  "/my-schedule": () => import("@/pages/MySchedule"),
  "/parent": () => import("@/pages/ParentDashboard"),
  "/people": () => import("@/pages/PeopleLanding"),
  "/quiz-engine": () => import("@/pages/QuizEngine"),
  "/reports": () => import("@/pages/Reports"),
  "/resources": () => import("@/pages/Resources"),
  "/salary": () => import("@/pages/SalaryEngine"),
  "/select-division": () => import("@/pages/SelectDivision"),
  "/settings": () => import("@/pages/SettingsLanding"),
  "/student-reports": () => import("@/pages/StudentReports"),
  "/students": () => import("@/pages/Students"),
  "/teacher": () => import("@/pages/TeacherNazraDashboard"),
  "/teaching": () => import("@/pages/TeachingLanding"),
  "/teaching-os": () => import("@/pages/TeachingOS"),
  "/user-management": () => import("@/pages/UserManagement"),
  "/work-hub": () => import("@/pages/WorkHub"),
};

const preloadedRoutes = new Map<string, Promise<unknown>>();

function normalizeRouteHref(href: string) {
  const [pathname] = href.split("?");
  return pathname.replace(/\/$/, "") || "/";
}

export function preloadRouteModule(href?: string | null) {
  if (!href) return Promise.resolve();

  const normalizedHref = normalizeRouteHref(href);
  const preloader = routePreloaders[normalizedHref];

  if (!preloader) return Promise.resolve();
  if (!preloadedRoutes.has(normalizedHref)) {
    preloadedRoutes.set(normalizedHref, preloader().catch((error) => {
      preloadedRoutes.delete(normalizedHref);
      throw error;
    }));
  }

  return preloadedRoutes.get(normalizedHref)!;
}

export function preloadRouteModules(hrefs: Array<string | null | undefined>) {
  return Promise.all(hrefs.map((href) => preloadRouteModule(href)));
}