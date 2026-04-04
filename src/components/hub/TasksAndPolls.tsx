import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { format, isPast } from 'date-fns';
import { Plus, ClipboardList, BarChart3, AlertTriangle, CheckCircle, Clock, Circle, MessageSquare, Forward } from 'lucide-react';
import { TaskDetailDialog } from '@/components/hub/TaskDetailDialog';

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  open: { icon: <Circle className="h-3 w-3" />, color: 'text-sky bg-sky/10' },
  in_progress: { icon: <Clock className="h-3 w-3" />, color: 'text-gold bg-gold/10' },
  completed: { icon: <CheckCircle className="h-3 w-3" />, color: 'text-teal bg-teal/10' },
};

const priorityConfig: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-gold/10 text-gold border-gold/20',
  medium: 'bg-sky/10 text-sky border-sky/20',
  low: 'bg-muted text-muted-foreground border-border',
};

export default function TasksAndPolls() {
  const { user, profile, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createPollOpen, setCreatePollOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', deadline: '', is_anonymous: false });
  const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''] });
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['workhub-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (!isAdmin) {
        query = query.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
      }
      const { data } = await query.limit(50);
      // Enrich names
      const ids = [...new Set((data || []).flatMap(t => [t.created_by, t.assigned_to].filter(Boolean)))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids as string[]);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return (data || []).map(t => ({ ...t, creatorName: nameMap[t.created_by] || 'Unknown', assigneeName: t.assigned_to ? nameMap[t.assigned_to] || 'Unassigned' : 'Unassigned' }));
    },
    enabled: !!user?.id,
  });

  // Fetch polls
  const { data: polls = [] } = useQuery({
    queryKey: ['workhub-polls', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: pollsData } = await supabase.from('polls').select('*, poll_options(*)').order('created_at', { ascending: false }).limit(20);
      // Get user's votes
      const pollIds = (pollsData || []).map(p => p.id);
      let userVotes: Record<string, string> = {};
      if (pollIds.length) {
        const { data: responses } = await supabase.from('poll_responses').select('poll_id, option_id').eq('user_id', user.id).in('poll_id', pollIds);
        userVotes = Object.fromEntries((responses || []).map(r => [r.poll_id, r.option_id]));
      }
      // Get vote counts
      const optionIds = (pollsData || []).flatMap(p => (p.poll_options || []).map((o: any) => o.id));
      let voteCounts: Record<string, number> = {};
      if (optionIds.length) {
        const { data: counts } = await supabase.from('poll_responses').select('option_id').in('option_id', optionIds);
        (counts || []).forEach(c => { voteCounts[c.option_id] = (voteCounts[c.option_id] || 0) + 1; });
      }
      return (pollsData || []).map(p => ({
        ...p,
        userVote: userVotes[p.id] || null,
        options: (p.poll_options || []).map((o: any) => ({ ...o, voteCount: voteCounts[o.id] || 0 })),
        totalVotes: (p.poll_options || []).reduce((sum: number, o: any) => sum + (voteCounts[o.id] || 0), 0),
      }));
    },
    enabled: !!user?.id,
  });

  // Create task
  const createTask = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase.from('tasks').insert({
        ...newTask,
        created_by: user.id,
        deadline: newTask.deadline || null,
        status: 'open',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workhub-tasks'] });
      setCreateTaskOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', deadline: '', is_anonymous: false });
      toast({ title: 'Task created' });
    },
  });

  // Create poll
  const createPoll = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { data: poll, error } = await supabase.from('polls')
        .insert({ title: newPoll.question, created_by: user.id, is_active: true })
        .select().single();
      if (error) throw error;
      const options = newPoll.options.filter(o => o.trim()).map((text, i) => ({
        poll_id: poll.id, option_text: text, sort_order: i,
      }));
      await supabase.from('poll_options').insert(options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workhub-polls'] });
      setCreatePollOpen(false);
      setNewPoll({ question: '', options: ['', ''] });
      toast({ title: 'Poll created' });
    },
  });

  // Vote on poll
  const votePoll = useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      if (!user?.id) return;
      const { error } = await supabase.from('poll_responses').insert({
        poll_id: pollId, option_id: optionId, user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workhub-polls'] }),
  });

  // Update task status
  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('tasks').update({ status }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workhub-tasks'] }),
  });

  const overdueTasks = tasks.filter((t: any) => t.deadline && isPast(new Date(t.deadline)) && t.status !== 'completed');

  return (
    <div className="space-y-4">
      {/* SLA Warning */}
      {overdueTasks.length > 0 && (
        <div className="rounded-xl bg-destructive/8 border border-destructive/20 px-3.5 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs font-semibold text-destructive">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} need attention</p>
        </div>
      )}

      <Tabs defaultValue="tasks">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="tasks" className="rounded-lg gap-1 text-xs">
              <ClipboardList className="h-3.5 w-3.5" /> Tasks
              {tasks.length > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{tasks.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="polls" className="rounded-lg gap-1 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Polls
              {polls.length > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{polls.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setCreatePollOpen(true)}>
              <BarChart3 className="h-3.5 w-3.5 mr-1" /> Poll
            </Button>
            <Button size="sm" onClick={() => setCreateTaskOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Task
            </Button>
          </div>
        </div>

        <TabsContent value="tasks" className="mt-3 space-y-2">
          {tasks.map((task: any) => {
            const sc = statusConfig[task.status] || statusConfig.open;
            const isOverdue = task.deadline && isPast(new Date(task.deadline)) && task.status !== 'completed';
            return (
              <Card key={task.id} className={`cursor-pointer hover:shadow-sm transition-shadow ${isOverdue ? 'border-destructive/30' : ''}`} onClick={() => setSelectedTask(task)}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[13px] font-bold text-foreground">{task.title}</p>
                        <Badge className={`text-[9px] px-1.5 py-0 h-4 border capitalize ${priorityConfig[task.priority] || priorityConfig.medium}`}>
                          {task.priority}
                        </Badge>
                        {isOverdue && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">Overdue</Badge>}
                        {task.source_type === 'chat' && (
                          <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 gap-0.5">
                            <MessageSquare className="h-2 w-2" /> Chat
                          </Badge>
                        )}
                      </div>
                      {task.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        <span>{task.is_anonymous ? 'Anonymous' : task.creatorName}</span>
                        <span>→ {task.assigneeName}</span>
                        {task.deadline && <span>Due: {format(new Date(task.deadline), 'MMM d')}</span>}
                      </div>
                    </div>
                    <Select value={task.status} onValueChange={v => { v && updateTaskStatus.mutate({ id: task.id, status: v }); }} >
                      <SelectTrigger className="w-28 h-7 text-[10px]" onClick={e => e.stopPropagation()}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No tasks yet</p>}
        </TabsContent>

        <TabsContent value="polls" className="mt-3 space-y-3">
          {polls.map((poll: any) => (
            <Card key={poll.id}>
              <CardContent className="p-3">
                <p className="text-[13px] font-bold text-foreground mb-2">{poll.question}</p>
                <div className="space-y-1.5">
                  {poll.options.map((opt: any) => {
                    const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                    const isVoted = poll.userVote === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !poll.userVote && votePoll.mutate({ pollId: poll.id, optionId: opt.id })}
                        disabled={!!poll.userVote}
                        className={`w-full text-left rounded-lg border px-3 py-2 relative overflow-hidden transition-colors ${
                          isVoted ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50'
                        }`}
                      >
                        {poll.userVote && (
                          <div className="absolute inset-0 bg-primary/10 rounded-lg" style={{ width: `${pct}%` }} />
                        )}
                        <div className="relative flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{opt.option_text}</span>
                          {poll.userVote && <span className="text-[10px] font-bold text-muted-foreground">{pct}%</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
          ))}
          {polls.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No polls yet</p>}
        </TabsContent>
      </Tabs>

      {/* Create Task Dialog */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title" /></div>
            <div><Label>Description</Label><Textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Details..." rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={newTask.priority} onValueChange={v => setNewTask(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Deadline</Label><Input type="date" value={newTask.deadline} onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newTask.is_anonymous} onCheckedChange={v => setNewTask(p => ({ ...p, is_anonymous: v }))} />
              <Label>Submit anonymously</Label>
            </div>
            <Button onClick={() => createTask.mutate()} disabled={!newTask.title.trim()}>Create Task</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Poll Dialog */}
      <Dialog open={createPollOpen} onOpenChange={setCreatePollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Poll</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Question</Label><Input value={newPoll.question} onChange={e => setNewPoll(p => ({ ...p, question: e.target.value }))} placeholder="What should we...?" /></div>
            <div>
              <Label>Options</Label>
              <div className="space-y-2">
                {newPoll.options.map((opt, i) => (
                  <Input key={i} value={opt} onChange={e => {
                    const opts = [...newPoll.options];
                    opts[i] = e.target.value;
                    setNewPoll(p => ({ ...p, options: opts }));
                  }} placeholder={`Option ${i + 1}`} />
                ))}
                <Button variant="outline" size="sm" onClick={() => setNewPoll(p => ({ ...p, options: [...p.options, ''] }))}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                </Button>
              </div>
            </div>
            <Button onClick={() => createPoll.mutate()} disabled={!newPoll.question.trim() || newPoll.options.filter(o => o.trim()).length < 2}>
              Create Poll
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
