import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowLeft, ExternalLink, FileText, Link2, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveFileUrl } from '@/lib/signedUrl';
import { SyllabusFolderLinkDialog } from '@/components/library/SyllabusFolderLinkDialog';

interface Item {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  url: string | null;
  file_path: string | null;
  syllabus_folder: string | null;
  syllabus_order: number | null;
}

/**
 * Library-driven syllabus. Folders come from the Library (approved items only)
 * and are matched to the student through course / class / subject links.
 */
export default function StudentSyllabus() {
  const { studentId: routeId } = useParams();
  const navigate = useNavigate();
  const { user, activeRole } = useAuth() as any;
  const studentId = routeId || user?.id || '';
  const isAdmin = String(activeRole || '').includes('admin');

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [linkFolder, setLinkFolder] = useState<string | null>(null);

  const { data: student } = useQuery({
    queryKey: ['student-syllabus-name', studentId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', studentId).maybeSingle();
      return data;
    },
    enabled: !!studentId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['student-syllabus', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const [courseRes, classRes, assignRes, enrolRes] = await Promise.all([
        supabase.from('course_enrollments').select('course_id').eq('student_id', studentId),
        supabase.from('course_class_students').select('class_id').eq('student_id', studentId),
        supabase.from('student_teacher_assignments').select('subject_id').eq('student_id', studentId),
        supabase.from('enrollments').select('subject_id').eq('student_id', studentId),
      ]);

      const courseIds = (courseRes.data || []).map((r: any) => r.course_id).filter(Boolean);
      const classIds = (classRes.data || []).map((r: any) => r.class_id).filter(Boolean);
      const subjectIds = [
        ...(assignRes.data || []).map((r: any) => r.subject_id),
        ...(enrolRes.data || []).map((r: any) => r.subject_id),
      ].filter(Boolean);

      const { data: links } = await (supabase.from('syllabus_folder_links') as any)
        .select('folder, course_id, class_id, subject_id');

      const myFolders = new Set<string>(
        ((links || []) as any[])
          .filter(
            (l) =>
              (l.course_id && courseIds.includes(l.course_id)) ||
              (l.class_id && classIds.includes(l.class_id)) ||
              (l.subject_id && subjectIds.includes(l.subject_id))
          )
          .map((l) => l.folder)
      );

      const { data: items } = await (supabase.from('library_items') as any)
        .select('id, title, description, type, url, file_path, syllabus_folder, syllabus_order')
        .eq('is_syllabus', true)
        .eq('approval_status', 'approved')
        .order('syllabus_folder')
        .order('syllabus_order');

      const all = ((items || []) as Item[]).filter((i) => !!i.syllabus_folder);
      const mine = myFolders.size ? all.filter((i) => myFolders.has(i.syllabus_folder!)) : [];
      return { items: mine.length ? mine : all, matched: mine.length > 0 };
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of data?.items || []) {
      const key = i.syllabus_folder!;
      map.set(key, [...(map.get(key) || []), i]);
    }
    return Array.from(map.entries());
  }, [data]);

  const folders = grouped.map(([f]) => f);
  const current = activeFolder && folders.includes(activeFolder) ? activeFolder : folders[0];
  const lessons = grouped.find(([f]) => f === current)?.[1] || [];

  const open = async (item: Item) => {
    if (item.url?.startsWith('/')) { navigate(item.url); return; }
    if (item.url) { window.open(item.url, '_blank', 'noopener'); return; }
    if (item.file_path) {
      const url = await resolveFileUrl(item.file_path);
      if (url) window.open(url, '_blank', 'noopener');
    }
  };

  const iconFor = (t: string | null) =>
    t === 'video' ? PlayCircle : t === 'link' ? Link2 : FileText;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-lms-navy">
            {student?.full_name ? `${student.full_name} — Syllabus` : 'My Syllabus'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.matched
              ? 'Lessons from the course library, in order.'
              : 'Showing every published syllabus folder until a course is connected.'}
          </p>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No lessons published yet</p>
          <p className="text-sm text-muted-foreground">
            Once a teacher adds lessons and an admin approves them, they appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          {/* Folder list — plain cards, no tab strip */}
          <nav className="space-y-2">
            {grouped.map(([folder, items]) => (
              <button
                key={folder}
                type="button"
                onClick={() => setActiveFolder(folder)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                  folder === current ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/50'
                )}
              >
                <span className="block font-semibold text-sm text-lms-navy">{folder}</span>
                <span className="text-xs text-muted-foreground">{items.length} lessons</span>
              </button>
            ))}
            {isAdmin && current && (
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setLinkFolder(current)}>
                <Link2 className="h-4 w-4" /> Who sees this?
              </Button>
            )}
          </nav>

          <ol className="space-y-2">
            {lessons.map((item, idx) => {
              const Icon = iconFor(item.type);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-lms-navy">{item.title}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-muted-foreground" dir="auto">
                          {item.description}
                        </span>
                      )}
                    </span>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <SyllabusFolderLinkDialog
        folder={linkFolder}
        open={!!linkFolder}
        onOpenChange={(o) => !o && setLinkFolder(null)}
      />
    </div>
  );
}
