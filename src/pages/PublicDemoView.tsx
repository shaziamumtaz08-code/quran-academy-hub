import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Video, User, BookOpen, Clock, Phone, Mail, Star, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { DemoChatPanel } from "@/components/demo/DemoChatPanel";


interface DemoData {
  audience: "teacher" | "student";
  demo: {
    id: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_min: number;
    timezone: string | null;
    platform: string | null;
    meeting_link: string | null;
    status: string;
    cancelled_at: string | null;
  };
  teacher: { id: string; name: string; photo: string | null } | null;
  student: any;
  existing_feedback: any;
}

function formatWhen(date: string, time: string, tz: string | null) {
  try {
    const d = new Date(`${date}T${time}`);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
      timeZone: tz || undefined,
      timeZoneName: tz ? "short" : undefined,
    }).format(d);
  } catch {
    return `${date} ${time}${tz ? ` (${tz})` : ""}`;
  }
}

export default function PublicDemoView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DemoData | null>(null);

  // feedback state
  const [rating, setRating] = useState<number>(0);
  const [interested, setInterested] = useState<string>("");
  const [recPackage, setRecPackage] = useState("");
  const [studentLevel, setStudentLevel] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: res, error } = await supabase.rpc("get_demo_by_share_token", { _token: token });
      if (error) console.error(error);
      setData((res as any) ?? null);
      // hydrate existing feedback
      const ef = (res as any)?.existing_feedback;
      if (ef) {
        setRating(ef.rating || 0);
        setInterested(ef.interested || "");
        setRecPackage(ef.recommended_package || "");
        setStudentLevel(ef.student_level || "");
        setNotes(ef.notes || "");
        setSubmitted(true);
      }
      setLoading(false);
    })();
  }, [token]);

  const phase = useMemo(() => {
    if (!data) return "loading";
    if (data.demo.status === "cancelled") return "cancelled";
    const end = new Date(`${data.demo.scheduled_date}T${data.demo.scheduled_time}`);
    end.setMinutes(end.getMinutes() + (data.demo.duration_min || 30) + 30);
    return new Date() >= end ? "feedback" : "details";
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold">Link not found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This shareable demo link is invalid or has been revoked. Please contact admissions.
          </p>
        </Card>
      </div>
    );
  }

  if (phase === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold">Demo cancelled</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This demo has been cancelled. If you believe this is a mistake, please contact admissions.
          </p>
        </Card>
      </div>
    );
  }

  const when = formatWhen(data.demo.scheduled_date, data.demo.scheduled_time, data.demo.timezone);
  const isTeacher = data.audience === "teacher";

  async function submitFeedback() {
    setSubmitting(true);
    const { data: res, error } = await supabase.rpc("submit_demo_feedback", {
      _token: token!,
      _rating: rating || null,
      _interested: interested || null,
      _recommended_package: recPackage || null,
      _student_level: studentLevel || null,
      _notes: notes || null,
    });
    setSubmitting(false);
    if (error || !(res as any)?.ok) {
      toast.error((res as any)?.error || "Could not submit feedback");
      return;
    }
    toast.success("Thank you! Your feedback has been recorded.");
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Al Quran Time Academy</div>
          <h1 className="text-2xl font-bold text-[#0f2044]">
            {phase === "feedback" ? "Demo Feedback" : isTeacher ? "Demo Assignment" : "Your Demo Class"}
          </h1>
          <Badge variant="secondary" className="mt-2">{isTeacher ? "Teacher view" : "Student view"}</Badge>
        </div>

        {phase === "details" && (
          <>
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-[#0f2044]" />
                <span className="font-medium">{when}</span>
                <span className="text-muted-foreground">· {data.demo.duration_min} min</span>
              </div>
              {data.demo.meeting_link && (
                <a href={data.demo.meeting_link} target="_blank" rel="noreferrer">
                  <Button className="w-full bg-[#0f2044] hover:bg-[#1a2d54]" size="lg">
                    <Video className="h-4 w-4 mr-2" /> Join {data.demo.platform || "class"}
                  </Button>
                </a>
              )}
            </Card>

            {isTeacher && data.student && (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Student details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <strong>{data.student.name}</strong></div>
                  {data.student.parent_name && <div><span className="text-muted-foreground">Parent:</span> {data.student.parent_name}</div>}
                  {data.student.age && <div><span className="text-muted-foreground">Age:</span> {data.student.age}</div>}
                  {data.student.country && <div><span className="text-muted-foreground">Country:</span> {data.student.country}{data.student.city ? `, ${data.student.city}` : ""}</div>}
                  {data.student.subject_interest && <div className="col-span-2"><span className="text-muted-foreground">Subject:</span> {data.student.subject_interest}</div>}
                  {data.student.preferred_time && <div className="col-span-2"><span className="text-muted-foreground">Preferred time:</span> <span className="whitespace-pre-wrap">{data.student.preferred_time}</span></div>}
                  {data.student.current_level && <div className="col-span-2"><span className="text-muted-foreground">Current level:</span> {data.student.current_level}</div>}
                  {data.student.learning_goals && <div className="col-span-2"><span className="text-muted-foreground">Goals:</span> {data.student.learning_goals}</div>}
                  {data.student.message && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {data.student.message}</div>}
                </div>
                <div className="border-t pt-3 flex flex-wrap gap-3 text-sm">
                  {data.student.phone && <a href={`tel:${data.student.phone}`} className="flex items-center gap-1 text-[#0f2044] hover:underline"><Phone className="h-3.5 w-3.5" /> {data.student.phone}</a>}
                  {data.student.email && <a href={`mailto:${data.student.email}`} className="flex items-center gap-1 text-[#0f2044] hover:underline"><Mail className="h-3.5 w-3.5" /> {data.student.email}</a>}
                </div>
              </Card>
            )}

            {!isTeacher && data.teacher && (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Your teacher</h3>
                <div className="flex items-center gap-3">
                  {data.teacher.photo ? (
                    <img src={data.teacher.photo} alt={data.teacher.name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-[#0f2044] text-white flex items-center justify-center font-semibold">
                      {data.teacher.name?.[0] || "T"}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{data.teacher.name}</div>
                    {data.student?.subject_interest && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> {data.student.subject_interest}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground border-t pt-3">
                  Please join 2–3 minutes early. Make sure you have a quiet space, headphones, and a stable internet connection. If you have a Quran/Mushaf, keep it handy.
                </p>
              </Card>
            )}

            <p className="text-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 inline mr-1" />
              Feedback form will open here 30 min after the class ends.
            </p>
          </>
        )}

        {phase === "feedback" && (
          <Card className="p-5 space-y-4">
            {submitted && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5" />
                <div>Feedback recorded. You can update it below if needed.</div>
              </div>
            )}
            <div>
              <h3 className="font-semibold">{isTeacher ? "How did the demo go?" : "How was your experience?"}</h3>
              <p className="text-xs text-muted-foreground">
                Demo with {isTeacher ? data.student?.name : data.teacher?.name} · {when}
              </p>
            </div>

            <div>
              <Label className="text-sm">Rating</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                    <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  </button>
                ))}
              </div>
            </div>

            {isTeacher ? (
              <>
                <div>
                  <Label className="text-sm">Student's current level</Label>
                  <Input value={studentLevel} onChange={(e) => setStudentLevel(e.target.value)} placeholder="e.g. Qaida ch.5, Surah Al-Mulk" />
                </div>
                <div>
                  <Label className="text-sm">Recommended package</Label>
                  <Input value={recPackage} onChange={(e) => setRecPackage(e.target.value)} placeholder="e.g. 3 days/week, 30 min" />
                </div>
                <div>
                  <Label className="text-sm">Should we proceed to enrollment?</Label>
                  <RadioGroup value={interested} onValueChange={setInterested} className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" /> Yes</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="maybe" /> Maybe</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" /> No</label>
                  </RadioGroup>
                </div>
              </>
            ) : (
              <div>
                <Label className="text-sm">Are you interested to enroll?</Label>
                <RadioGroup value={interested} onValueChange={setInterested} className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" /> Yes</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="maybe" /> Maybe</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" /> No</label>
                </RadioGroup>
              </div>
            )}

            <div>
              <Label className="text-sm">{isTeacher ? "Observations / next steps" : "Comments"}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Share any details that will help admissions..." />
            </div>

            <Button onClick={submitFeedback} disabled={submitting} className="w-full bg-[#0f2044] hover:bg-[#1a2d54]">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitted ? "Update feedback" : "Submit feedback"}
            </Button>
          </Card>
        )}

        {token && (
          <DemoChatPanel
            token={token}
            otherPartyName={isTeacher ? (data.student?.name || "the student") : (data.teacher?.name || "your teacher")}
          />
        )}
      </div>

    </div>
  );
}
