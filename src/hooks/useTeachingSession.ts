import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/**
 * Persists the current Teaching OS session context (session_id, syllabus_id)
 * in localStorage. If the URL is missing session_id, auto-restores from localStorage
 * and redirects so the user never loses their work.
 */
export function useTeachingSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionIdFromUrl = searchParams.get('session_id');
  const syllabusIdFromUrl = searchParams.get('syllabus_id');
  const courseIdFromUrl = searchParams.get('course_id');

  // Persist to localStorage when present in URL
  useEffect(() => {
    if (sessionIdFromUrl) {
      localStorage.setItem('tos-last-session-id', sessionIdFromUrl);
    }
    if (syllabusIdFromUrl) {
      localStorage.setItem('tos-last-syllabus-id', syllabusIdFromUrl);
    }
    if (courseIdFromUrl) {
      localStorage.setItem('tos-last-course-id', courseIdFromUrl);
    }
  }, [sessionIdFromUrl, syllabusIdFromUrl, courseIdFromUrl]);

  // Auto-restore if session_id missing from URL
  useEffect(() => {
    if (!sessionIdFromUrl) {
      const savedSessionId = localStorage.getItem('tos-last-session-id');
      if (savedSessionId) {
        const params = new URLSearchParams(searchParams);
        params.set('session_id', savedSessionId);
        const savedSylId = localStorage.getItem('tos-last-syllabus-id');
        if (savedSylId && !params.has('syllabus_id')) params.set('syllabus_id', savedSylId);
        const savedCourseId = localStorage.getItem('tos-last-course-id');
        if (savedCourseId && !params.has('course_id')) params.set('course_id', savedCourseId);
        navigate(`${window.location.pathname}?${params.toString()}`, { replace: true });
      }
    }
  }, [sessionIdFromUrl]);

  return {
    sessionId: sessionIdFromUrl,
    syllabusId: syllabusIdFromUrl,
    courseId: courseIdFromUrl,
  };
}
