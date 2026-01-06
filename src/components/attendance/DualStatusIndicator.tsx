import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, XCircle, AlertTriangle, Eye, Wifi, WifiOff, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DualStatusIndicatorProps {
  manualStatus: string;
  zoomDetected: boolean | null; // null = no data, true = joined, false = no join found
  zoomDurationMinutes?: number | null;
  scheduledDurationMinutes?: number;
  isLateEntry?: boolean;
  lateMinutes?: number;
}

export function DualStatusIndicator({
  manualStatus,
  zoomDetected,
  zoomDurationMinutes,
  scheduledDurationMinutes = 30,
  isLateEntry = false,
  lateMinutes = 0,
}: DualStatusIndicatorProps) {
  // Calculate if there's a mismatch (ghosting)
  const isGhosting = manualStatus === 'present' && zoomDetected === false;
  
  // Calculate if time thief (<80% of scheduled)
  const durationPercent = zoomDurationMinutes && scheduledDurationMinutes 
    ? (zoomDurationMinutes / scheduledDurationMinutes) * 100 
    : null;
  const isTimeThief = durationPercent !== null && durationPercent < 80;

  const getManualStatusDisplay = () => {
    switch (manualStatus) {
      case 'present':
        return { icon: CheckCircle, label: 'Present', color: 'text-emerald-600 dark:text-emerald-400' };
      case 'student_absent':
        return { icon: XCircle, label: 'Absent', color: 'text-destructive' };
      case 'teacher_absent':
      case 'teacher_leave':
        return { icon: XCircle, label: 'Teacher Off', color: 'text-accent' };
      case 'rescheduled':
        return { icon: AlertTriangle, label: 'Rescheduled', color: 'text-primary' };
      default:
        return { icon: HelpCircle, label: manualStatus, color: 'text-muted-foreground' };
    }
  };

  const getZoomStatusDisplay = () => {
    if (zoomDetected === null) {
      return { icon: HelpCircle, label: 'No Data', color: 'text-muted-foreground', bg: 'bg-muted/50' };
    }
    if (zoomDetected) {
      return { icon: Wifi, label: 'Detected', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
    }
    return { icon: WifiOff, label: 'Not Found', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
  };

  const manual = getManualStatusDisplay();
  const zoom = getZoomStatusDisplay();
  const ManualIcon = manual.icon;
  const ZoomIcon = zoom.icon;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Manual Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1 cursor-help",
                manual.color,
                isGhosting && "border-amber-500"
              )}
            >
              <ManualIcon className="h-3 w-3" />
              <span className="text-[10px]">Manual</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-semibold">Teacher Marked: {manual.label}</p>
            <p className="text-xs text-muted-foreground">This is the status entered manually by the teacher</p>
          </TooltipContent>
        </Tooltip>

        {/* Zoom System Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="secondary"
              className={cn(
                "gap-1 cursor-help",
                zoom.color,
                zoom.bg,
                isGhosting && "border-amber-500 animate-pulse"
              )}
            >
              <ZoomIcon className="h-3 w-3" />
              <span className="text-[10px]">System</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-semibold">Zoom Evidence: {zoom.label}</p>
              {zoomDurationMinutes !== null && zoomDurationMinutes !== undefined && (
                <p className="text-xs">Duration: {zoomDurationMinutes} mins</p>
              )}
              {isLateEntry && (
                <p className="text-xs text-amber-600">Late Entry: +{lateMinutes} mins</p>
              )}
              {zoomDetected === null && (
                <p className="text-xs text-muted-foreground">No Zoom attendance log found for this session</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Alert Badges */}
        {isGhosting && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="gap-1 text-[9px] px-1.5">
                <Eye className="h-3 w-3" />
                Ghost
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold text-destructive">Ghosting Detected</p>
              <p className="text-xs">Marked present but no Zoom evidence found</p>
            </TooltipContent>
          </Tooltip>
        )}

        {isTimeThief && !isGhosting && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 text-[9px] px-1.5 text-amber-600 border-amber-500">
                <AlertTriangle className="h-3 w-3" />
                {Math.round(durationPercent!)}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold text-amber-600">Short Session</p>
              <p className="text-xs">Attended only {zoomDurationMinutes} of {scheduledDurationMinutes} scheduled mins</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
