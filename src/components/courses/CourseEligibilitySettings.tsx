import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { toast as legacyToast } from '@/hooks/use-toast';
import { Plus, Trash2, ShieldCheck, BookOpen, BarChart, GraduationCap, Loader2, Copy, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react';

interface Props {
  courseId: string;
}

export function CourseEligibilitySettings({ courseId }: Props) {
  const queryClient = useQueryClient();
  const [addType, setAddType] = useState('');
  const [prereqCourseId, setPrereqCourseId] = useState('');
  const [minAttendance, setMinAttendance] = useState('75');
  const [scriptCopied, setScriptCopied] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['eligibility-rules', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_eligibility_rules')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['all-courses-list'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, name').neq('id', courseId).order('name');
      return data || [];
    },
  });

  const { data: courseData } = useQuery({
    queryKey: ['course-settings', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('webhook_secret, auto_enroll_enabled, name').eq('id', courseId).single();
      return data;
    },
  });

  const toggleAutoEnroll = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('courses').update({ auto_enroll_enabled: enabled }).eq('id', courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-settings', courseId] });
      toast.success('Auto-decide setting updated');
    },
  });

  const addRule = useMutation({
    mutationFn: async () => {
      let ruleValue: any = {};
      if (addType === 'prerequisite_course') ruleValue = { course_id: prereqCourseId };
      else if (addType === 'min_attendance') ruleValue = { threshold: parseInt(minAttendance) || 75 };
      else if (addType === 'must_pass_exam') ruleValue = {};

      const { error } = await supabase.from('course_eligibility_rules').insert({
        course_id: courseId,
        rule_type: addType as any,
        rule_value: ruleValue,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eligibility-rules', courseId] });
      setAddType('');
      setPrereqCourseId('');
      legacyToast({ title: 'Rule added' });
    },
    onError: (e: any) => legacyToast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('course_eligibility_rules')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eligibility-rules', courseId] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_eligibility_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eligibility-rules', courseId] });
      legacyToast({ title: 'Rule removed' });
    },
  });

  const generateWebhookSecret = useMutation({
    mutationFn: async () => {
      const secret = crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase.from('courses').update({ webhook_secret: secret }).eq('id', courseId);
      if (error) throw error;
      return secret;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-settings', courseId] });
      toast.success('Webhook secret generated');
    },
  });

  const ruleTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    prerequisite_course: { label: 'Prerequisite Course', icon: BookOpen, color: 'text-blue-600' },
    min_attendance: { label: 'Min Attendance %', icon: BarChart, color: 'text-amber-600' },
    must_pass_exam: { label: 'Must Pass Exam', icon: GraduationCap, color: 'text-emerald-600' },
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string || '';
  const webhookUrl = `${supabaseUrl}/functions/v1/applicant-webhook`;
  const secret = courseData?.webhook_secret || '';

  // Build the ready-to-paste Google Apps Script
  const googleScript = `function onFormSubmit(e) {
  var r = e.response.getItemResponses();
  var fields = {};
  for (var i = 0; i < r.length; i++) {
    fields[r[i].getItem().getTitle()] = r[i].getResponse();
  }

  var payload = {
    full_name: fields[Object.keys(fields)[0]] || "",
    email: "",
    phone: "",
    city: "",
    gender: "",
    source: "google_form",
    course_id: "${courseId}",
    webhook_secret: "${secret}",
    extra: fields
  };

  // Auto-detect common field names
  var keys = Object.keys(fields);
  for (var j = 0; j < keys.length; j++) {
    var k = keys[j].toLowerCase();
    var v = fields[keys[j]];
    if (k.indexOf("email") > -1) payload.email = v;
    else if (k.indexOf("phone") > -1 || k.indexOf("mobile") > -1 || k.indexOf("whatsapp") > -1 || k.indexOf("contact") > -1) payload.phone = v;
    else if (k.indexOf("city") > -1) payload.city = v;
    else if (k.indexOf("gender") > -1) payload.gender = v;
    else if (k.indexOf("name") > -1 && (k.indexOf("full") > -1 || k.indexOf("your") > -1 || k === "name" || k.indexOf("student") > -1)) payload.full_name = v;
  }

  UrlFetchApp.fetch("${webhookUrl}", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}

// Run this ONCE to set up the automatic trigger
function createTrigger() {
  ScriptApp.newTrigger("onFormSubmit")
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();
  Logger.log("✅ Trigger created! New responses will auto-sync.");
}`;

  const handleCopyScript = async () => {
    // Auto-generate secret if not present
    if (!secret) {
      const newSecret = crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase.from('courses').update({ webhook_secret: newSecret }).eq('id', courseId);
      if (error) {
        toast.error('Failed to generate secret');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['course-settings', courseId] });
      // Build script with new secret inline
      const updatedScript = googleScript.replace(`"${secret}"`, `"${newSecret}"`);
      await navigator.clipboard.writeText(updatedScript);
    } else {
      await navigator.clipboard.writeText(googleScript);
    }
    setScriptCopied(true);
    toast.success('Script copied! Paste it in Google Forms → Script Editor');
    setTimeout(() => setScriptCopied(false), 5000);
  };

  return (
    <div className="space-y-4">
      {/* Auto-decide toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Auto-decide applicants</p>
              <p className="text-xs text-muted-foreground">
                When enabled, applicants are automatically accepted or rejected based on eligibility rules at submission time.
              </p>
            </div>
            <Switch
              checked={courseData?.auto_enroll_enabled || false}
              onCheckedChange={(v) => toggleAutoEnroll.mutate(v)}
            />
          </div>
          {courseData?.auto_enroll_enabled ? (
            <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
              <p className="text-xs text-emerald-700">
                Applicants will be auto-enrolled if they pass all rules, or auto-rejected with reason.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              All applicants go to "New" status for manual review.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Enrollment Eligibility Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Define rules that applicants must meet before enrollment.
          </p>

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-3">No rules configured — all applicants are eligible by default.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule: any) => {
                const cfg = ruleTypeConfig[rule.rule_type] || ruleTypeConfig.prerequisite_course;
                const Icon = cfg.icon;
                const courseName = rule.rule_type === 'prerequisite_course'
                  ? courses.find(c => c.id === rule.rule_value?.course_id)?.name || 'Unknown course'
                  : '';
                return (
                  <div key={rule.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Icon className={`h-4 w-4 ${cfg.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cfg.label}</p>
                      {rule.rule_type === 'prerequisite_course' && (
                        <p className="text-xs text-muted-foreground">Must complete: {courseName}</p>
                      )}
                      {rule.rule_type === 'min_attendance' && (
                        <p className="text-xs text-muted-foreground">Minimum: {rule.rule_value?.threshold || 0}%</p>
                      )}
                    </div>
                    <Switch checked={rule.is_active} onCheckedChange={v => toggleRule.mutate({ id: rule.id, isActive: v })} />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteRule.mutate(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add rule */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-medium">Add Rule</Label>
            <div className="flex gap-2 flex-wrap">
              <Select value={addType} onValueChange={setAddType}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select rule type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prerequisite_course">Prerequisite Course</SelectItem>
                  <SelectItem value="min_attendance">Min Attendance %</SelectItem>
                  <SelectItem value="must_pass_exam">Must Pass Exam</SelectItem>
                </SelectContent>
              </Select>

              {addType === 'prerequisite_course' && (
                <Select value={prereqCourseId} onValueChange={setPrereqCourseId}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {addType === 'min_attendance' && (
                <Input type="number" value={minAttendance} onChange={e => setMinAttendance(e.target.value)}
                  className="w-24" placeholder="75" min={0} max={100} />
              )}

              <Button size="sm" onClick={() => addRule.mutate()}
                disabled={!addType || (addType === 'prerequisite_course' && !prereqCourseId) || addRule.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Form Sync — Simple Wizard */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            📋 Connect Google Form
            <Badge variant="secondary" className="text-[10px]">3 clicks</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Sync any Google Form with this course. All new responses will automatically appear in the <strong>Applicants</strong> tab. No coding needed.
          </p>

          {/* Step 1 */}
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Copy the auto-sync script</p>
              <p className="text-xs text-muted-foreground">
                This script is pre-configured for <strong>{courseData?.name || 'this course'}</strong>. It auto-detects fields like Name, Email, Phone from any Google Form — no editing needed.
              </p>
              <Button
                onClick={handleCopyScript}
                className="w-full sm:w-auto"
                variant={scriptCopied ? "outline" : "default"}
              >
                {scriptCopied ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" /> Copied! Now go to Step 2</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" /> Copy Script to Clipboard</>
                )}
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Paste into Google Form</p>
              <div className="bg-muted rounded-lg p-3 text-xs space-y-1.5">
                <p>Open your Google Form → click <strong>⋮ (three dots)</strong> menu → <strong>Script editor</strong></p>
                <p>Delete any existing code → <strong>Paste</strong> the copied script → <strong>Save</strong> (Ctrl+S)</p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Activate the trigger</p>
              <div className="bg-muted rounded-lg p-3 text-xs space-y-1.5">
                <p>In the Script editor → click <strong>▶ Run</strong> → select <strong>createTrigger</strong> from dropdown → click <strong>▶ Run</strong></p>
                <p>Google will ask for permission → click <strong>"Allow"</strong></p>
                <p className="text-emerald-600 font-medium">✅ Done! Every new form response will appear in Applicants automatically.</p>
              </div>
            </div>
          </div>

          {/* Secret management — collapsed/minimal */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Security key:</span>
                {secret ? (
                  <Badge variant="outline" className="text-[10px] font-mono">{secret.slice(0, 8)}…</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Auto-generated on copy</Badge>
                )}
              </div>
              {secret && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => generateWebhookSecret.mutate()}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
