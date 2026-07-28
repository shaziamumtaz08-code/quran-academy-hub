import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function QuizInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'signin'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        sessionStorage.setItem('pending_quiz_invite', token || '');
        setState('signin');
        return;
      }
      const { error } = await supabase.rpc('accept_quiz_invite' as any, { _token: token });
      if (error) {
        setMessage(error.message);
        setState('error');
        return;
      }
      sessionStorage.removeItem('pending_quiz_invite');
      setState('ok');
      setTimeout(() => navigate('/quiz-engine'), 1200);
    })();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-3">
          {state === 'loading' && <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />}
          {state === 'ok' && (
            <>
              <CheckCircle2 className="h-8 w-8 mx-auto text-primary" />
              <p className="text-sm">Invite accepted. Opening the Quiz Engine…</p>
            </>
          )}
          {state === 'signin' && (
            <>
              <p className="text-sm text-muted-foreground">Sign in to accept this quiz invitation.</p>
              <Button onClick={() => navigate('/login')}>Sign in</Button>
            </>
          )}
          {state === 'error' && (
            <>
              <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
              <p className="text-sm text-muted-foreground">{message || 'This invite is not valid.'}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
