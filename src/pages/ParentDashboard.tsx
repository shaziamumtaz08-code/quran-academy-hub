import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useKidContext } from '@/contexts/KidContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChildrenDashboardView } from '@/components/dashboard/shared/ChildrenDashboardView';

export default function ParentDashboard() {
  const { user } = useAuth();
  const { studentId } = useParams();
  const { kids, activeKidId, setActiveKidId, isLoading } = useKidContext();

  useEffect(() => {
    if (!studentId) return;
    if (kids.some((kid) => kid.id === studentId) && studentId !== activeKidId) {
      setActiveKidId(studentId);
    }
  }, [studentId, kids, activeKidId, setActiveKidId]);

  if (!user?.id) return null;

  const studentIds = activeKidId ? [activeKidId] : kids.map((kid) => kid.id);
  const emptyMessage = isLoading ? 'Loading family...' : 'No linked children available';

  return (
    <DashboardLayout>
      <ChildrenDashboardView
        studentIds={studentIds}
        showChildToggle={false}
        emptyMessage={emptyMessage}
      />
    </DashboardLayout>
  );
}
