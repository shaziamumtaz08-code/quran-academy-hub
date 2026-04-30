/**
 * Centralized student route allowlist.
 *
 * Phase 1: keep students confined to a small surface and prevent privilege
 * leaks into admin/teacher pages. Used by route guards in App.tsx and by nav
 * components that want to know whether to surface a link to a student.
 *
 * Routes here can be exact paths ("/dashboard") or prefixes ("/my-courses").
 * isStudentRouteAllowed handles both forms.
 */

export const STUDENT_ALLOWED_ROUTES: readonly string[] = [
  '/dashboard',
  '/my-courses',         // matches /my-courses and /my-courses/:id
  '/my-quizzes',
  '/student-reports',
  '/resources',          // student-accessible read view (assigned / shared)
  '/my-resources',
  '/communication',
  '/chat',
  '/notifications',
  '/work-hub',
  '/hub',
  '/workhub',
  '/classroom',          // /classroom/:sessionId
  '/connections',        // /connections/:userType/:userId
  '/select-division',    // soft — guard will still bounce non-super_admins
  '/parent',             // hybrid student+parent users
] as const;

/**
 * Returns true if `pathname` falls under any allowed student route.
 * Matches exact paths and `/<base>/...` sub-paths.
 */
export function isStudentRouteAllowed(pathname: string): boolean {
  if (!pathname) return false;
  return STUDENT_ALLOWED_ROUTES.some(
    (allowed) => pathname === allowed || pathname.startsWith(allowed + '/'),
  );
}
