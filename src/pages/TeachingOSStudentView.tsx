import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Hand, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Activity {
  phase: string;
  title: string;
  durationMinutes: number;
}

export default function TeachingOSStudentView() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [sessionTitle, setSessionTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [handRaised, setHandRaised] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data } = await supabase
        .from('session_plans')
        .select('*, syllabi(course_name)')
        .eq('id', sessionId)
        .single();
      if (data) {
        setSessionTitle(data.session_title || '');
        setCourseName((data as any).syllabi?.course_name || '');
        const acts = (typeof data.activities === 'string'
          ? JSON.parse(data.activities) : data.activities) as Activity[];
        setActivities(acts);
      }
      setLoading(false);
    })();
  }, [sessionId]);

  const progress = activities.length > 0 ? ((currentIdx + 1) / activities.length) * 100 : 0;
  const current = activities[currentIdx];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a56b0]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#0f2044] flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-[18px] font-semibold text-[#0f2044]">{sessionTitle}</h1>
          <p className="text-[13px] text-[#7a7f8a] mt-1">{courseName}</p>
        </div>

        {/* Current Activity */}
        {current && (
          <div className="bg-white border border-[#e8e9eb] rounded-xl p-5 mb-4 text-center">
            <div className="text-[10px] uppercase text-[#aab0bc] tracking-wider font-medium mb-2">
              Current Activity
            </div>
            <div className="text-[16px] font-medium text-[#0f2044] mb-1">{current.title}</div>
            <div className="text-[12px] text-[#7a7f8a]">{current.phase} · {current.durationMinutes} min</div>
          </div>
        )}

        {/* Progress */}
        <div className="bg-white border border-[#e8e9eb] rounded-xl p-4 mb-4">
          <div className="flex justify-between text-[11px] text-[#7a7f8a] mb-2">
            <span>{currentIdx + 1} of {activities.length} activities</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-[#e8e9eb] rounded-full overflow-hidden">
            <div className="h-full bg-[#1a56b0] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Raise Hand */}
        <button
          onClick={() => {
            setHandRaised(!handRaised);
            toast.success(handRaised ? 'Hand lowered' : 'Hand raised — teacher will see this');
          }}
          className={`w-full py-3 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-colors ${handRaised
            ? 'bg-[#fff8e6] text-[#8a5c00] border border-[#e0dc90]'
            : 'bg-[#0f2044] text-white hover:bg-[#1a2d54]'
            }`}
        >
          <Hand className="w-4 h-4" />
          {handRaised ? '✋ Hand raised — tap to lower' : 'Raise hand'}
        </button>

        {/* Activity List */}
        <div className="mt-6 space-y-1">
          {activities.map((act, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] ${i === currentIdx ? 'bg-[#eef2fa] text-[#1a56b0] font-medium' : i < currentIdx ? 'text-[#aab0bc]' : 'text-[#7a7f8a]'}`}
            >
              {i < currentIdx ? <CheckCircle2 className="w-3.5 h-3.5 text-[#1a7340]" /> : <div className={`w-3.5 h-3.5 rounded-full border ${i === currentIdx ? 'border-[#1a56b0] bg-[#1a56b0]' : 'border-[#d0d4dc]'}`} />}
              {act.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
