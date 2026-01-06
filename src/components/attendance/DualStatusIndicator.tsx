import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, XCircle, AlertTriangle, Eye, Wifi, WifiOff, HelpCircle, Clock } from 'lucide-react';
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
  // Calculate if there's a mismatch (ghosting) - RED: Manual present but 0 mins
  const isGhosting = manualStatus === 'present' && (zoomDetected === false || (zoomDetected === true && (zoomDurationMinutes === 0 || zoomDurationMinutes === null)));
  
  // AMBER: Manual present but <15 mins
  const isLowDuration = manualStatus === 'present' && zoomDetected === true && 
    zoomDurationMinutes !== null && zoomDurationMinutes > 0 && zoomDurationMinutes < 15;
  
  // Calculate if time thief (<80% of scheduled)
  const durationPercent = zoomDurationMinutes && scheduledDurationMinutes 
    ? (zoomDurationMinutes / scheduledDurationMinutes) * 100 
    : null;
  const isTimeThief = durationPercent !== null && durationPercent < 80 && !isGhosting && !isLowDuration;

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
    if (zoomDetected && zoomDurationMinutes && zoomDurationMinutes >= 15) {
      return { icon: Wifi, label: 'Detected', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
    }
    if (zoomDetected && zoomDurationMinutes && zoomDurationMinutes > 0 && zoomDurationMinutes < 15) {
      return { icon: Clock, label: `${zoomDurationMinutes}m`, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
    }
    return { icon: WifiOff, label: 'Not Found', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
  };

  const manual = getManualStatusDisplay();
  const zoom = getZoomStatusDisplay();
  const ManualIcon = manual.icon;
  const ZoomIcon = zoom.icon;

  // Determine overall highlight color for the indicator
  const getContainerClass = () => {
    if (isGhosting) return 'ring-2 ring-red-500 ring-offset-1 rounded-lg p-1';
    if (isLowDuration) return 'ring-2 ring-amber-500 ring-offset-1 rounded-lg p-1';
    return '';
  };

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", getContainerClass())}>
        {/* Manual Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1 cursor-help",
                manual.color,
                isGhosting && "border-red-500 bg-red-50 dark:bg-red-900/30",
                isLowDuration && !isGhosting && "border-amber-500 bg-amber-50 dark:bg-amber-900/30"
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
                isGhosting && "border-red-500 animate-pulse",
                isLowDuration && !isGhosting && "border-amber-500"
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

        {/* Alert Badges - Priority: Ghosting > Low Duration > Time Thief */}
        {isGhosting && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="gap-1 text-[9px] px-1.5 animate-pulse">
                <Eye className="h-3 w-3" />
                Ghost
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold text-destructive">Ghosting Detected (RED)</p>
              <p className="text-xs">Marked present but Zoom shows 0 minutes</p>
              <p className="text-xs text-muted-foreground mt-1">This requires immediate attention</p>
            </TooltipContent>
          </Tooltip>
        )}

        {isLowDuration && !isGhosting && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 text-[9px] px-1.5 text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-900/30">
                <Clock className="h-3 w-3" />
                {zoomDurationMinutes}m
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold text-amber-600">Low Duration (AMBER)</p>
              <p className="text-xs">Only {zoomDurationMinutes} mins detected (&lt;15 mins)</p>
              <p className="text-xs text-muted-foreground mt-1">Review required</p>
            </TooltipContent>
          </Tooltip>
        )}

        {isTimeThief && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 text-[9px] px-1.5 text-orange-600 border-orange-500">
                <AlertTriangle className="h-3 w-3" />
                {Math.round(durationPercent!)}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold text-orange-600">Short Session</p>
              <p className="text-xs">Attended only {zoomDurationMinutes} of {scheduledDurationMinutes} scheduled mins</p>
            </TooltipContent>
          </Tooltip>
        )}

        {isLateEntry && !isGhosting && !isLowDuration && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 text-[9px] px-1.5 text-blue-600 border-blue-500">
                <Clock className="h-3 w-3" />
                +{lateMinutes}m
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold text-blue-600">Late Entry</p>
              <p className="text-xs">Joined {lateMinutes} minutes after session start</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
