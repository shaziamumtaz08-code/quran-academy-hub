import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Sends the signed-in user to the right profile page for their active role.
 * Teachers -> /teacher-profile, students -> /student-profile,
 * parents -> /parent-profile, everyone else -> teacher-style staff profile.
 */
export default function MyProfile() {
  const { profile, activeRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile?.id) return <Navigate to="/login" replace />;

  const role = activeRole || profile.role || profile.roles?.[0];

  if (role === 'student') return <Navigate to={`/student-profile/${profile.id}`} replace />;
  if (role === 'parent') return <Navigate to={`/parent-profile/${profile.id}`} replace />;
  return <Navigate to={`/teacher-profile/${profile.id}`} replace />;
}
