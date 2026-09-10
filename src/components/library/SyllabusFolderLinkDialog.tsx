import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";

const NONE = "__none__";

/**
 * Admin tool: connect a Library syllabus folder to a course, a class or a
 * subject. Students enrolled on that course / class / subject then see the
 * folder on their Syllabus page automatically.
 */
export function SyllabusFolderLinkDialog({
  folder, open, onOpenChange,
}: {
  folder: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState(NONE);
  const [classId, setClassId] = useState(NONE);
  const [subjectId, setSubjectId] = useState(NONE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setCourseId(NONE); setClassId(NONE); setSubjectId(NONE); }
  }, [open, folder]);

  const { data: courses = [] } = useQuery({
    queryKey: ["syllabus-link-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, name").order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["syllabus-link-classes", courseId],
    queryFn: async () => {
      let q = supabase.from("course_classes").select("id, name, course_id").order("name");
      if (courseId !== NONE) q = q.eq("course_id", courseId);
      const { data } = await q;
      return data || [];
    },
    enabled: open,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["syllabus-link-subjects"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, name").order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: links = [], refetch } = useQuery({
    queryKey: ["syllabus-folder-links", folder],
    queryFn: async () => {
      const { data } = await (supabase.from("syllabus_folder_links") as any)
        .select("id, course_id, class_id, subject_id")
        .eq("folder", folder);
      return (data || []) as any[];
    },
    enabled: open && !!folder,
  });

  const nameOf = (list: any[], id: string | null) =>
    list.find((x: any) => x.id === id)?.name ?? null;

  const add = async () => {
    if (!folder) return;
    if (courseId === NONE && classId === NONE && subjectId === NONE) {
      toast.error("Pick a course, a class or a subject first");
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase.from("syllabus_folder_links") as any).insert({
        folder,
        course_id: courseId === NONE ? null : courseId,
        class_id: classId === NONE ? null : classId,
        subject_id: subjectId === NONE ? null : subjectId,
      });
      if (error) throw error;
      toast.success("Folder connected");
      setCourseId(NONE); setClassId(NONE); setSubjectId(NONE);
      refetch();
      qc.invalidateQueries({ queryKey: ["student-syllabus"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await (supabase.from("syllabus_folder_links") as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetch();
    qc.invalidateQueries({ queryKey: ["student-syllabus"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Who sees “{folder}”?
          </DialogTitle>
          <DialogDescription>
            Connect this folder to a course, a class or a subject. Everyone enrolled
            there sees these lessons on their Syllabus page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {links.length > 0 && (
            <ul className="rounded-lg border divide-y">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    {nameOf(courses, l.course_id) ? `Course: ${nameOf(courses, l.course_id)}` : null}
                    {nameOf(classes, l.class_id) ? ` Class: ${nameOf(classes, l.class_id)}` : null}
                    {nameOf(subjects, l.subject_id) ? ` Subject: ${nameOf(subjects, l.subject_id)}` : null}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => remove(l.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any</SelectItem>
                  {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any</SelectItem>
                  {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any</SelectItem>
                  {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={add} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
