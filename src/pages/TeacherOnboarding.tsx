import { useParams } from 'react-router-dom';
import { TeacherOnboardingWizard } from '@/components/teachers/TeacherOnboardingWizard';
import { GraduationCap } from 'lucide-react';

export default function TeacherOnboarding() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-serif font-bold text-foreground">Teacher onboarding</h1>
            <p className="text-xs text-muted-foreground">
              Complete your AQTA profile — everything already on file is pre-filled.
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {token ? (
          <TeacherOnboardingWizard token={token} />
        ) : (
          <p className="text-muted-foreground">Missing onboarding token.</p>
        )}
      </main>
    </div>
  );
}
