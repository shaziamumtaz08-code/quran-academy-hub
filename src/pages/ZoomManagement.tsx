import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminLiveMonitor } from '@/components/dashboard/AdminLiveMonitor';
import { LiveClassQueue } from '@/components/dashboard/LiveClassQueue';
import { useToast } from '@/hooks/use-toast';
import { Video, Plus, Trash2, Wifi, WifiOff, Settings, Users, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ZoomManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newLicense, setNewLicense] = React.useState({ zoom_email: '', meeting_link: '', host_id: '' });
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

  // Fetch all zoom licenses
  const { data: licenses, isLoading: licensesLoading } = useQuery({
    queryKey: ['zoom-licenses-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_licenses')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all live sessions with details
  const { data: liveSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['all-live-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select(`
          id,
          teacher_id,
          actual_start,
          actual_end,
          status,
          created_at,
          license:zoom_licenses(id, zoom_email, meeting_link)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Get teacher names
      const teacherIds = [...new Set(data.map(s => s.teacher_id))];
      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);

      const teacherMap = new Map(teachers?.map(t => [t.id, t.full_name]) || []);

      return data.map(session => ({
        ...session,
        teacherName: teacherMap.get(session.teacher_id) || 'Unknown',
      }));
    },
    refetchInterval: 30000,
  });

  // Fetch attendance logs
  const { data: attendanceLogs } = useQuery({
    queryKey: ['all-attendance-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_attendance_logs')
        .select(`
          id,
          user_id,
          action,
          timestamp,
          session_id
        `)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(l => l.user_id))];
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

      return data.map(log => ({
        ...log,
        userName: userMap.get(log.user_id) || 'Unknown',
      }));
    },
    refetchInterval: 30000,
  });

  // Add license mutation
  const addLicenseMutation = useMutation({
    mutationFn: async (license: typeof newLicense) => {
      const { error } = await supabase
        .from('zoom_licenses')
        .insert({
          zoom_email: license.zoom_email,
          meeting_link: license.meeting_link,
          host_id: license.host_id || null,
          status: 'available',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'License Added', description: 'New Zoom license has been added successfully.' });
      setNewLicense({ zoom_email: '', meeting_link: '', host_id: '' });
      setAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-management'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete license mutation
  const deleteLicenseMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      const { error } = await supabase
        .from('zoom_licenses')
        .delete()
        .eq('id', licenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'License Removed', description: 'Zoom license has been removed.' });
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-management'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const availableCount = licenses?.filter(l => l.status === 'available').length || 0;
  const busyCount = licenses?.filter(l => l.status === 'busy').length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Zoom Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage Zoom licenses and monitor live sessions</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <Wifi className="h-3 w-3" />
              {availableCount} Available
            </Badge>
            <Badge variant="secondary" className="gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              <WifiOff className="h-3 w-3" />
              {busyCount} In Use
            </Badge>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LiveClassQueue />
          <AdminLiveMonitor />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="licenses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="licenses" className="gap-2">
              <Settings className="h-4 w-4" />
              Licenses
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2">
              <Video className="h-4 w-4" />
              Session History
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Users className="h-4 w-4" />
              Join Logs
            </TabsTrigger>
          </TabsList>

          {/* Licenses Tab */}
          <TabsContent value="licenses" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-serif">Zoom Licenses</CardTitle>
                  <CardDescription>Manage your Zoom meeting room licenses</CardDescription>
                </div>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add License
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif">Add New Zoom License</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="zoom_email">Zoom Email</Label>
                        <Input
                          id="zoom_email"
                          placeholder="room1@academy.com"
                          value={newLicense.zoom_email}
                          onChange={(e) => setNewLicense({ ...newLicense, zoom_email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meeting_link">Meeting Link (PMI)</Label>
                        <Input
                          id="meeting_link"
                          placeholder="https://zoom.us/j/1234567890"
                          value={newLicense.meeting_link}
                          onChange={(e) => setNewLicense({ ...newLicense, meeting_link: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="host_id">Host ID (Optional)</Label>
                        <Input
                          id="host_id"
                          placeholder="Optional Zoom Host ID"
                          value={newLicense.host_id}
                          onChange={(e) => setNewLicense({ ...newLicense, host_id: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                      <Button 
                        onClick={() => addLicenseMutation.mutate(newLicense)}
                        disabled={!newLicense.zoom_email || !newLicense.meeting_link || addLicenseMutation.isPending}
                      >
                        Add License
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead>Zoom Email</TableHead>
                      <TableHead>Meeting Link</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licenses?.map((license, idx) => (
                      <TableRow key={license.id}>
                        <TableCell className="font-medium">Room {idx + 1}</TableCell>
                        <TableCell>{license.zoom_email}</TableCell>
                        <TableCell>
                          <a 
                            href={license.meeting_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-accent hover:underline text-sm"
                          >
                            Open Link
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            license.status === 'available' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          )}>
                            {license.status === 'available' ? 'Available' : 'In Use'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {license.last_used_at 
                            ? format(new Date(license.last_used_at), 'MMM d, HH:mm')
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this license?')) {
                                deleteLicenseMutation.mutate(license.id);
                              }
                            }}
                            disabled={license.status === 'busy'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!licenses || licenses.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No Zoom licenses configured. Add your first license to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-serif">Session History</CardTitle>
                  <CardDescription>All live sessions and their durations</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['all-live-sessions'] })}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Zoom Room</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Ended</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liveSessions?.map((session) => {
                        const duration = session.actual_start && session.actual_end
                          ? differenceInMinutes(new Date(session.actual_end), new Date(session.actual_start))
                          : session.actual_start && session.status === 'live'
                            ? differenceInMinutes(new Date(), new Date(session.actual_start))
                            : 0;

                        return (
                          <TableRow key={session.id}>
                            <TableCell className="font-medium">{session.teacherName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(session.license as any)?.zoom_email?.split('@')[0] || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {session.actual_start 
                                ? format(new Date(session.actual_start), 'MMM d, HH:mm')
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              {session.actual_end 
                                ? format(new Date(session.actual_end), 'HH:mm')
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              {duration > 0 ? `${duration} min` : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                session.status === 'live' && 'bg-emerald-100 text-emerald-700 animate-pulse',
                                session.status === 'completed' && 'bg-gray-100 text-gray-700',
                                session.status === 'scheduled' && 'bg-blue-100 text-blue-700'
                              )}>
                                {session.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!liveSessions || liveSessions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No session history available.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Student Join Logs</CardTitle>
                <CardDescription>Track when students join their classes</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Session</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceLogs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.userName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Video className="h-3 w-3" />
                              {log.action === 'join_intent' ? 'Joined' : log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {log.session_id?.slice(0, 8)}...
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!attendanceLogs || attendanceLogs.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No join logs recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
