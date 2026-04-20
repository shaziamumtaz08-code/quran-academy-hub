import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, GraduationCap, Calendar, Clock, Star, Pencil, Moon, PenTool, Mic, Languages, Sparkles } from 'lucide-react';
import { DivisionBadge, type DivisionKind } from '@/components/shared/DivisionBadge';
import { StatusDot } from '@/components/shared/StatusDot';

export interface CourseCardData {
  id: string;
  name: string;
  thumbnail_url?: string | null;
  hero_image_url?: string | null;
  subject_name?: string | null;
  teacher_name?: string | null;
  level?: string | null;
  schedule?: string | null;
  duration?: string | null;
  enrolled_count?: number;
  max_seats?: number | null;
  status?: 'open' | 'full' | 'coming_soon' | 'closed' | string;
  pricing?: { amount?: number; currency?: string; period?: string } | null;
  seo_slug?: string | null;
  /** Identity: division kind (resolved from course's division.model_type by caller) */
  division_kind?: DivisionKind;
  division_model_type?: string | null;
  division_name?: string | null;
  /** Identity: enrollment status for the viewing student (active/paused/completed/left) */
  enrollment_status?: string | null;
}

interface Props {
  course: CourseCardData;
  onClick?: () => void;
  onEdit?: () => void;
  ctaLabel?: string;
  showEditOverlay?: boolean;
  className?: string;
}

// Subject → default illustration mapping
function getSubjectVisual(subject?: string | null): { icon: React.ReactNode; gradient: string; emoji: string } {
  const s = (subject || '').toLowerCase();
  if (s.includes('quran') || s.includes('qur\'an')) {
    return { icon: <Moon className="w-12 h-12" />, gradient: 'from-emerald-500/20 via-emerald-400/10 to-teal-500/20', emoji: '☪' };
  }
  if (s.includes('hifz') || s.includes('memori')) {
    return { icon: <Star className="w-12 h-12" />, gradient: 'from-amber-500/20 via-yellow-400/10 to-orange-500/20', emoji: '⭐' };
  }
  if (s.includes('arabic') || s.includes('calligraphy')) {
    return { icon: <PenTool className="w-12 h-12" />, gradient: 'from-rose-500/20 via-pink-400/10 to-fuchsia-500/20', emoji: '✍' };
  }
  if (s.includes('tajweed') || s.includes('recitation')) {
    return { icon: <Mic className="w-12 h-12" />, gradient: 'from-violet-500/20 via-purple-400/10 to-indigo-500/20', emoji: '🎙' };
  }
  if (s.includes('urdu') || s.includes('language')) {
    return { icon: <Languages className="w-12 h-12" />, gradient: 'from-sky-500/20 via-blue-400/10 to-cyan-500/20', emoji: '🗣' };
  }
  if (s.includes('islam') || s.includes('fiqh') || s.includes('aqeed')) {
    return { icon: <Sparkles className="w-12 h-12" />, gradient: 'from-teal-500/20 via-emerald-400/10 to-green-500/20', emoji: '✦' };
  }
  return { icon: <BookOpen className="w-12 h-12" />, gradient: 'from-primary/15 via-primary/5 to-accent/15', emoji: '📚' };
}

function getStatusBadge(status?: string, enrolled = 0, max?: number | null) {
  if (status === 'coming_soon') return { label: 'Coming Soon', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (status === 'full' || (max && enrolled >= max)) return { label: 'Full', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
  if (status === 'closed') return { label: 'Closed', cls: 'bg-muted text-muted-foreground border-border' };
  return { label: 'Open', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
}

export default function CourseThumbnailCard({
  course, onClick, onEdit, ctaLabel = 'View Course', showEditOverlay = false, className = '',
}: Props) {
  const visual = getSubjectVisual(course.subject_name);
  const statusBadge = getStatusBadge(course.status, course.enrolled_count, course.max_seats);
  const thumb = course.thumbnail_url || course.hero_image_url;
  const seatsLeft = course.max_seats ? Math.max(0, course.max_seats - (course.enrolled_count || 0)) : null;

  return (
    <div
      onClick={onClick}
      className={`group relative bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl hover:border-primary/40 transition-all duration-300 cursor-pointer flex flex-col ${className}`}
    >
      {/* Edit overlay (admin) */}
      {showEditOverlay && onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="absolute top-2 right-2 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground"
          title="Edit course"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Thumbnail */}
      <div className="relative h-36 overflow-hidden">
        {thumb ? (
          <div
            className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
            style={{ backgroundImage: `url(${thumb})` }}
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${visual.gradient} flex items-center justify-center`}>
            <div className="text-primary/40">{visual.icon}</div>
            <div className="absolute top-2 left-2 text-3xl opacity-30">{visual.emoji}</div>
          </div>
        )}
        {/* Status badge (top-right) */}
        <div className="absolute top-2 right-2">
          <Badge variant="outline" className={`text-[10px] ${statusBadge.cls}`}>{statusBadge.label}</Badge>
        </div>
        {/* Identity: Division badge (top-left) */}
        {(course.division_kind || course.division_model_type || course.division_name) && (
          <div className="absolute top-2 left-2">
            <DivisionBadge
              kind={course.division_kind}
              modelType={course.division_model_type}
              name={course.division_name}
              size="xs"
            />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 flex-wrap">
          {course.subject_name && (
            <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-medium">{course.subject_name}</Badge>
          )}
          {course.level && (
            <Badge variant="outline" className="text-[10px]">{course.level}</Badge>
          )}
        </div>

        <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {course.name}
        </h3>

        <div className="space-y-1 text-[11px] text-muted-foreground">
          {course.teacher_name && (
            <div className="flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> {course.teacher_name}</div>
          )}
          {course.schedule && (
            <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {course.schedule}</div>
          )}
          {course.duration && (
            <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {course.duration}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 mt-auto border-t border-border">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{course.enrolled_count ?? 0}{course.max_seats ? `/${course.max_seats}` : ''}</span>
            {seatsLeft !== null && seatsLeft > 0 && seatsLeft <= 5 && (
              <span className="ml-1 text-amber-600 font-medium">· {seatsLeft} left</span>
            )}
            {course.enrollment_status && (
              <span className="ml-1.5 inline-flex"><StatusDot status={course.enrollment_status} size="xs" /></span>
            )}
          </div>
          {course.pricing?.amount ? (
            <span className="text-sm font-black text-primary">
              {course.pricing.currency || '$'}{course.pricing.amount}
              <span className="text-[10px] font-normal text-muted-foreground">/{course.pricing.period || 'mo'}</span>
            </span>
          ) : (
            <span className="text-[11px] font-bold text-muted-foreground">Free</span>
          )}
        </div>

        {ctaLabel && (
          <Button size="sm" className="w-full mt-1" variant="default" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
