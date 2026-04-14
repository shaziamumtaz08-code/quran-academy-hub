import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';

export interface PhaseNavProps {
  /** 1-based current phase number */
  currentPhase: number;
  /** syllabus_id to carry forward */
  syllabusId?: string | null;
  /** session_id to carry forward (phases 3-7 need this) */
  sessionId?: string | null;
  /** course_id for analytics/parent */
  courseId?: string | null;
  /** Course name for breadcrumb */
  courseName?: string;
  /** Current section label for breadcrumb */
  sectionLabel?: string;
}

const PHASES = [
  { num: 0, label: 'Outline',    short: 'Out',    path: '/teaching-os/outline',         color: '#0f2044' },
  { num: 1, label: 'Syllabus',   short: 'Syl',    path: '/teaching-os',                color: '#534AB7' },
  { num: 2, label: 'Planner',    short: 'Plan',   path: '/teaching-os/planner',         color: '#1a56b0' },
  { num: 3, label: 'Day Board',  short: 'Board',  path: '/teaching-os/dayboard',        color: '#8a5c00' },
  { num: 4, label: 'Content Kit',short: 'Kit',    path: '/teaching-os/content-kit',     color: '#1a7340' },
  { num: 5, label: 'Assessment', short: 'Assess', path: '/teaching-os/assessment',      color: '#b42a2a' },
  { num: 6, label: 'Video',      short: 'Video',  path: '/teaching-os/video',           color: '#993556' },
  { num: 7, label: 'Speaking',   short: 'Speak',  path: '/teaching-os/speaking-tutor',  color: '#854F0B' },
  { num: 8, label: 'Analytics',  short: 'Stats',  path: '/teaching-os/analytics',       color: '#185FA5' },
  { num: 9, label: 'Parent',     short: 'Parent', path: '/parent',                      color: '#0f2044' },
];

function buildPhaseUrl(phase: typeof PHASES[number], syllabusId?: string | null, sessionId?: string | null, courseId?: string | null): string {
  const params = new URLSearchParams();

  if (syllabusId) {
    params.set('syllabus_id', syllabusId);
  }
  if (sessionId) {
    params.set('session_id', sessionId);
  }
  if (courseId) {
    params.set('course_id', courseId);
  }

  if (phase.num >= 3 && phase.num <= 7 && !sessionId) {
    const plannerParams = new URLSearchParams();
    if (syllabusId) plannerParams.set('syllabus_id', syllabusId);
    if (courseId) plannerParams.set('course_id', courseId);
    const plannerQs = plannerParams.toString();
    return plannerQs ? `/teaching-os/planner?${plannerQs}` : '/teaching-os/planner';
  }

  const qs = params.toString();
  return qs ? `${phase.path}?${qs}` : phase.path;
}

/**
 * Compact horizontal phase stepper shown in each Teaching OS sidebar.
 * Shows all 9 phases as small numbered circles. Completed phases are green with checkmark.
 * Current phase is highlighted in its own color. Future phases are gray.
 * All phases are clickable.
 */
export function PhaseStepperCompact({ currentPhase, syllabusId, sessionId, courseId }: PhaseNavProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-[3px] px-3 py-2 border-b border-[#f0f1f3] flex-wrap">
      {PHASES.map((phase, i) => {
        const isDone = phase.num < currentPhase;
        const isCurrent = phase.num === currentPhase;

        return (
          <React.Fragment key={phase.num}>
            {i > 0 && <ChevronRight className="w-[10px] h-[10px] text-[#aab0bc]" />}
            <button
              onClick={() => navigate(buildPhaseUrl(phase, syllabusId, sessionId, courseId))}
              className="flex items-center gap-[2px] hover:opacity-80 transition-opacity"
              title={`Phase ${phase.num}: ${phase.label}`}
            >
              {isDone ? (
                <CheckCircle2 className="w-[13px] h-[13px] text-[#1a7340]" />
              ) : isCurrent ? (
                <div
                  className="w-[13px] h-[13px] rounded-full flex items-center justify-center text-[7px] font-bold text-white"
                  style={{ backgroundColor: phase.color }}
                >
                  {phase.num}
                </div>
              ) : (
                <Circle className="w-[13px] h-[13px] text-[#d0d4dc]" />
              )}
              <span
                className="text-[8px] font-medium"
                style={{ color: isCurrent ? phase.color : isDone ? '#1a7340' : '#aab0bc' }}
              >
                {phase.short}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Horizontal stepper for the Planner top bar (slightly larger).
 */
export function PhaseStepperTopBar({ currentPhase, syllabusId, sessionId, courseId }: PhaseNavProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {PHASES.map((phase, i) => {
        const isDone = phase.num < currentPhase;
        const isCurrent = phase.num === currentPhase;

        return (
          <React.Fragment key={phase.num}>
            {i > 0 && <div className="w-3 h-px bg-[#d0d4dc]" />}
            <button
              onClick={() => navigate(buildPhaseUrl(phase, syllabusId, sessionId, courseId))}
              className={`flex items-center gap-1 text-[10px] transition-opacity hover:opacity-80 ${
                isCurrent ? 'text-[#0f2044] font-medium' : isDone ? 'text-[#1a7340]' : 'text-[#aab0bc]'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1a7340]" />
              ) : isCurrent ? (
                <div
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ backgroundColor: phase.color }}
                >
                  {phase.num}
                </div>
              ) : (
                <Circle className="w-3 h-3 text-[#d0d4dc]" />
              )}
              {phase.short}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * "Next phase" button for sidebar footers.
 */
export function NextPhaseButton({ currentPhase, syllabusId, sessionId, courseId }: PhaseNavProps) {
  const navigate = useNavigate();
  const nextPhase = PHASES.find(p => p.num === currentPhase + 1);

  if (!nextPhase) return null;

  return (
    <button
      onClick={() => navigate(buildPhaseUrl(nextPhase, syllabusId, sessionId, courseId))}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-white rounded-[7px] hover:opacity-90 transition-opacity"
      style={{ backgroundColor: '#0f2044' }}
    >
      Next: {nextPhase.label}
      <ChevronRight className="w-3.5 h-3.5" />
    </button>
  );
}

/**
 * Breadcrumb: Teaching OS > CourseName > SectionLabel
 */
export function PhaseBreadcrumb({ courseName, sectionLabel }: { courseName?: string; sectionLabel?: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const syllabusId = searchParams.get('syllabus_id');
  const sessionId = searchParams.get('session_id');
  const courseId = searchParams.get('course_id');

  return (
    <div className="text-[11px] text-[#7a7f8a]">
      <button
        type="button"
        onClick={() => navigate(buildPhaseUrl(PHASES[0], syllabusId, sessionId, courseId))}
        className="hover:text-[#1a56b0]"
      >
        Teaching OS
      </button>
      {courseName && (
        <>
          <ChevronRight className="inline w-3 h-3 mx-1" />
          <button
            type="button"
            onClick={() => navigate(buildPhaseUrl(PHASES[1], syllabusId, sessionId, courseId))}
            className="text-[#4a5264] hover:text-[#1a56b0]"
          >
            {courseName}
          </button>
        </>
      )}
      {sectionLabel && (
        <>
          <ChevronRight className="inline w-3 h-3 mx-1" />
          <span className="text-[#4a5264] font-medium">{sectionLabel}</span>
        </>
      )}
    </div>
  );
}
