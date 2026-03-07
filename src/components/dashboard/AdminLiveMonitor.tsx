import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Video,
  Clock,
  Wifi,
  WifiOff,
  User,
  Activity,
  UserPlus,
  UserMinus,
  Power,
  ExternalLink,
  Link,
  Radio,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, differenceInSeconds } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useZoomRealtimeEvents } from "@/hooks/useZoomRealtimeEvents";

interface AdminLiveMonitorProps {
  className?: string;
}

interface SessionParticipant {
  userId: string;
  userName: string;
  isTeacher: boolean;
}

interface LiveEvent {
  id: string;
  userName: string;
  action: "join" | "leave";
  timestamp: Date;
}

export function AdminLiveMonitor({ className }: AdminLiveMonitorProps) {
  const [now, setNow] = React.useState(new Date());
  const [recordingLinks, setRecordingLinks] = React.useState<Record<string, string>>({});
  const [liveEvents, setLiveEvents] = React.useState<LiveEvent[]>([]);
  const queryClient = useQueryClient();

  // Subscribe to realtime Zoom events
  useZoomRealtimeEvents({
    showToasts: true,
    onEvent: (event) => {
      setLiveEvents((prev) =>
        [
          {
            id: event.id,
            userName: event.userName,
            action: event.action,
            timestamp: event.timestamp,
          },
          ...prev,
        ].slice(0, 10),
      ); // Keep last 10 events
    },
  });

  // Update timer every second for live duration
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // End session mutation - releases the license and optionally saves recording link
  const endSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      licenseId,
      recordingLink,
    }: {
      sessionId: string;
      licenseId: string;
      recordingLink?: string;
    }) => {
      // Update session to completed with optional recording link
      const updateData: Record<string, any> = {
        status: "completed",
        actual_end: new Date().toISOString(),
      };

      if (recordingLink && recordingLink.trim()) {
        updateData.recording_link = recordingLink.trim();
      }

      const { error: sessionError } = await supabase.from("live_sessions").update(updateData).eq("id", sessionId);

      if (sessionError) throw sessionError;

      // Release the license
      const { error: licenseError } = await supabase
        .from("zoom_licenses")
        .update({ status: "available" })
        .eq("id", licenseId);

      if (licenseError) throw licenseError;
    },
    onSuccess: (_, variables) => {
      toast.success("Session ended and license released");
      // Clear the recording link input
      setRecordingLinks((prev) => {
        const updated = { ...prev };
        delete updated[variables.sessionId];
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ["active-live-sessions-monitor"] });
      queryClient.invalidateQueries({ queryKey: ["zoom-licenses-monitor"] });
    },
    onError: (error) => {
      toast.error("Failed to end session: " + (error as Error).message);
    },
  });

  // Handle join as admin
  const handleJoinAsAdmin = (meetingLink: string) => {
    window.open(meetingLink, "_blank", "noopener,noreferrer");
    toast.info("Opening Zoom meeting in new tab");
  };

  // Fetch all zoom licenses and their status
  const { data: licenses, isLoading: licensesLoading } = useQuery({
    queryKey: ["zoom-licenses-monitor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zoom_licenses")
        .select("id, zoom_email, status, last_used_at, meeting_link");

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Fetch active live sessions with participants (simple headcount)
  const { data: liveSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["active-live-sessions-monitor"],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from("live_sessions")
        .select(
          `
          id,
          teacher_id,
          actual_start,
          scheduled_start,
          status,
          group_id,
          license:zoom_licenses(id, zoom_email, meeting_link)
        `,
        )
        .in("status", ["live"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!sessions || sessions.length === 0) return [];

      // Get teacher names
      const teacherIds = sessions.map((s) => s.teacher_id);
      const { data: teachers } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);

      const teacherMap = new Map(teachers?.map((t) => [t.id, t.full_name]) || []);

      // Get all participants who joined each session and haven't left
      const sessionIds = sessions.map((s) => s.id);
      const { data: attendanceLogs } = await supabase
        .from("zoom_attendance_logs")
        .select("session_id, user_id, action, leave_time")
        .in("session_id", sessionIds);

      // Filter to get only users who are currently in session (joined but no leave_time)
      const activeParticipants = attendanceLogs?.filter((log) => log.action === "join_intent" && !log.leave_time) || [];

      const allUserIds = new Set<string>();
      activeParticipants.forEach((log) => allUserIds.add(log.user_id));
      teacherIds.forEach((id) => allUserIds.add(id));

      const { data: allUsers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(allUserIds));

      const userMap = new Map(allUsers?.map((u) => [u.id, u.full_name]) || []);

      // Build participants list per session
      const participantsMap = new Map<string, SessionParticipant[]>();

      sessions.forEach((session) => {
        const participants: SessionParticipant[] = [];

        // Add teacher as first participant
        participants.push({
          userId: session.teacher_id,
          userName: teacherMap.get(session.teacher_id) || "Teacher",
          isTeacher: true,
        });

        // Add students who are currently active (no leave_time)
        activeParticipants
          .filter((log) => log.session_id === session.id)
          .forEach((log) => {
            if (log.user_id !== session.teacher_id && !participants.some((p) => p.userId === log.user_id)) {
              participants.push({
                userId: log.user_id,
                userName: userMap.get(log.user_id) || "Student",
                isTeacher: false,
              });
            }
          });

        participantsMap.set(session.id, participants);
      });

      return sessions.map((session) => ({
        ...session,
        teacherName: teacherMap.get(session.teacher_id) || "Unknown",
        participants: participantsMap.get(session.id) || [],
        activeCount: participantsMap.get(session.id)?.length || 1,
      }));
    },
    refetchInterval: 5000,
  });

  // Fetch recent join logs with live updates
  const { data: recentJoins, isLoading: joinsLoading } = useQuery({
    queryKey: ["recent-join-logs-monitor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zoom_attendance_logs")
        .select(
          `
          id,
          user_id,
          action,
          timestamp,
          session_id
        `,
        )
        .eq("action", "join_intent")
        .order("timestamp", { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map((l) => l.user_id))];
      const { data: users } = await supabase.from("profiles").select("id, full_name").in("id", userIds);

      const userMap = new Map(users?.map((u) => [u.id, u.full_name]) || []);

      return data.map((log) => ({
        ...log,
        userName: userMap.get(log.user_id) || "Unknown",
        timeAgo: getTimeAgo(new Date(log.timestamp)),
      }));
    },
    refetchInterval: 5000,
  });

  const isLoading = licensesLoading || sessionsLoading || joinsLoading;
  const availableLicenses = licenses?.filter((l) => l.status === "available").length || 0;
  const busyLicenses = licenses?.filter((l) => l.status === "busy").length || 0;
  const totalLicenses = licenses?.length || 0;

  // Format duration
  const formatDuration = (startTime: string | null) => {
    if (!startTime) return "0:00";
    const start = new Date(startTime);
    const diffSec = differenceInSeconds(now, start);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent animate-pulse" />
            Live Sessions Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="pb-3 bg-gradient-to-r from-[hsl(var(--navy))]/5 to-transparent">
          <CardTitle className="font-serif flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              Live Sessions Monitor
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              >
                <Wifi className="h-3 w-3" />
                {availableLicenses}/{totalLicenses} Free
              </Badge>
              {busyLicenses > 0 && (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                >
                  <WifiOff className="h-3 w-3" />
                  {busyLicenses} Active
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {/* License Status Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {licenses?.map((license, idx) => (
              <div
                key={license.id}
                className={cn(
                  "relative rounded-lg p-2 border text-center transition-all duration-300",
                  license.status === "available"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ring-2 ring-red-400/50 animate-pulse",
                )}
              >
                <div
                  className={cn(
                    "w-3 h-3 rounded-full mx-auto mb-1",
                    license.status === "available" ? "bg-emerald-500" : "bg-red-500 animate-pulse",
                  )}
                />
                <p className="text-[10px] text-muted-foreground">Room {idx + 1}</p>
                <p
                  className={cn(
                    "text-[10px] font-semibold",
                    license.status === "available" ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {license.status === "available" ? "Ready" : "Live"}
                </p>
              </div>
            ))}
          </div>

          {/* Active Sessions - Simple Headcount */}
          {liveSessions && liveSessions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Sessions ({liveSessions.length})
              </h4>
              <div className="grid gap-3">
                {liveSessions.map((session) => {
                  const licenseData = session.license as any;
                  const meetingLink = licenseData?.meeting_link;
                  const licenseId = licenseData?.id;
                  const isLive = session.status === "live";
                  const displayTime = session.actual_start || session.scheduled_start;

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "rounded-xl p-4 border",
                        isLive
                          ? "bg-gradient-to-r from-accent/5 to-transparent border-accent/20"
                          : "bg-gradient-to-r from-amber-50 dark:from-amber-900/10 to-transparent border-amber-200 dark:border-amber-800/30",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div
                              className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center",
                                isLive ? "bg-accent/10" : "bg-amber-100 dark:bg-amber-900/30",
                              )}
                            >
                              <Video className={cn("h-5 w-5", isLive ? "text-accent" : "text-amber-600")} />
                            </div>
                            {/* Status Badge */}
                            <Badge
                              variant="secondary"
                              className={cn(
                                "absolute -bottom-1 -right-1 text-[9px] px-1.5 py-0",
                                isLive ? "bg-red-500 text-white animate-pulse" : "bg-amber-500 text-white",
                              )}
                            >
                              {isLive ? "LIVE" : "Ready"}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{session.teacherName}</p>
                            <p className="text-xs text-muted-foreground">
                              {licenseData?.zoom_email?.split("@")[0] || "No license assigned"}
                            </p>
                          </div>
                        </div>

                        {/* Simple Active Participant Count with Tooltip */}
                        <div className="flex items-center gap-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border",
                                  isLive
                                    ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800"
                                    : "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-3 h-3 rounded-full",
                                    isLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500",
                                  )}
                                />
                                <span
                                  className={cn(
                                    "text-2xl font-bold",
                                    isLive
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-amber-700 dark:text-amber-400",
                                  )}
                                >
                                  {session.activeCount}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isLive
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-amber-600 dark:text-amber-400",
                                  )}
                                >
                                  {isLive ? "Active" : "Waiting"}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold text-xs mb-2">Participants:</p>
                                {session.participants.map((p, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <div
                                      className={cn("w-2 h-2 rounded-full", p.isTeacher ? "bg-accent" : "bg-primary")}
                                    />
                                    <span>{p.userName}</span>
                                    {p.isTeacher && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                                        Teacher
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>

                          <div className="text-right">
                            <div className={cn("flex items-center gap-1.5", isLive ? "text-accent" : "text-amber-600")}>
                              <Clock className="h-4 w-4" />
                              <span className="text-lg font-mono font-bold">
                                {isLive
                                  ? formatDuration(session.actual_start)
                                  : format(new Date(displayTime || new Date()), "HH:mm")}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {isLive ? "Duration" : "Scheduled"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Admin Action Buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                        {meetingLink && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2 text-xs"
                            onClick={() => handleJoinAsAdmin(meetingLink)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Join as Admin
                            <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1 gap-2 text-xs"
                              disabled={endSessionMutation.isPending}
                            >
                              <Power className="h-3.5 w-3.5" />
                              End Session
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>End this session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will mark the session as completed and release the Zoom license for{" "}
                                {session.teacherName}'s class. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>

                            {/* Recording Link Input */}
                            <div className="py-3 space-y-2">
                              <Label htmlFor={`recording-${session.id}`} className="text-sm flex items-center gap-2">
                                <Link className="h-3.5 w-3.5" />
                                Recording Link (Optional)
                              </Label>
                              <Input
                                id={`recording-${session.id}`}
                                placeholder="Paste Zoom recording link..."
                                value={recordingLinks[session.id] || ""}
                                onChange={(e) =>
                                  setRecordingLinks((prev) => ({
                                    ...prev,
                                    [session.id]: e.target.value,
                                  }))
                                }
                                className="text-sm"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                If provided, students will be able to view the recording in their past classes.
                              </p>
                            </div>

                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  if (licenseId) {
                                    endSessionMutation.mutate({
                                      sessionId: session.id,
                                      licenseId,
                                      recordingLink: recordingLinks[session.id],
                                    });
                                  }
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                End Session
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Event Feed - Realtime */}
          {liveEvents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Radio className="h-4 w-4 text-accent animate-pulse" />
                Live Activity
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent">
                  REALTIME
                </Badge>
              </h4>
              <ScrollArea className="h-32">
                <div className="space-y-1.5 pr-4">
                  {liveEvents.map((event, idx) => (
                    <div
                      key={event.id}
                      className={cn(
                        "flex items-center justify-between text-xs py-2 px-3 rounded-lg border transition-all",
                        event.action === "join"
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30"
                          : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30",
                        idx === 0 && "animate-fade-in ring-2 ring-accent/30",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center",
                            event.action === "join"
                              ? "bg-emerald-100 dark:bg-emerald-900/50"
                              : "bg-amber-100 dark:bg-amber-900/50",
                          )}
                        >
                          {event.action === "join" ? (
                            <UserPlus className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <UserMinus className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          )}
                        </div>
                        <div>
                          <span className="text-foreground font-medium">{event.userName}</span>
                          <span
                            className={cn(
                              "ml-1.5 text-[10px]",
                              event.action === "join" ? "text-emerald-600" : "text-amber-600",
                            )}
                          >
                            {event.action === "join" ? "joined" : "left"}
                          </span>
                        </div>
                      </div>
                      <span className="text-muted-foreground text-[10px]">{format(event.timestamp, "HH:mm:ss")}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Recent Join Logs */}
          {recentJoins && recentJoins.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Recent Joins (History)
              </h4>
              <ScrollArea className="h-28">
                <div className="space-y-1 pr-4">
                  {recentJoins.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-xs py-2 px-3 bg-secondary/40 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-[10px] font-medium text-primary">
                            {log.userName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-foreground font-medium">{log.userName}</span>
                      </div>
                      <span className="text-muted-foreground">{log.timeAgo}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty State */}
          {(!liveSessions || liveSessions.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No Active Classes</p>
              <p className="text-xs">All Zoom rooms are available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// Helper function for time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return format(date, "MMM d, HH:mm");
}
