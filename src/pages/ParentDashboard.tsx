import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useKidContext } from '@/contexts/KidContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';

export default function ParentDashboard() {
  const { user } = useAuth();
  const { studentId } = useParams();
  const { kids, activeKidId, setActiveKidId, isLoading } = useKidContext();

  // Sync route param -> active kid
  useEffect(() => {
    if (!studentId) return;
    if (kids.some((kid) => kid.id === studentId) && studentId !== activeKidId) {
      setActiveKidId(studentId);
    }
  }, [studentId, kids, activeKidId, setActiveKidId]);

  // Default to first kid if none active
  useEffect(() => {
    if (!activeKidId && kids.length > 0) setActiveKidId(kids[0].id);
  }, [activeKidId, kids, setActiveKidId]);

  if (!user?.id) return null;

  return (
    <DashboardLayout>
      {kids.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          {isLoading ? 'Loading family...' : 'No linked children available'}
        </div>
      ) : (
        <StudentDashboard />
      )}
    </DashboardLayout>
  );
}
