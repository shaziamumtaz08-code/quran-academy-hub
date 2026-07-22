import React, { useState, lazy, Suspense, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Inbox, MessageCircle, CheckSquare, Settings2, MessageSquareWarning, ThumbsUp, Lightbulb, ClipboardList, CalendarOff, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TicketList } from '@/components/hub/TicketList';
import { CreateTicketDialog } from '@/components/hub/CreateTicketDialog';
import { SubcategoryManager } from '@/components/hub/SubcategoryManager';
import TasksAndPolls from '@/components/hub/TasksAndPolls';
import { cn } from '@/lib/utils';

const MessagesTab = lazy(() => import('@/components/hub/MessagesTab'));

const QUICK_CATEGORIES = [
  { value: 'complaint', label: 'Complaint', icon: MessageSquareWarning, color: 'text-red-600' },
  { value: 'feedback', label: 'Feedback', icon: ThumbsUp, color: 'text-emerald-600' },
  { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: 'text-amber-600' },
  { value: 'task', label: 'Task', icon: ClipboardList, color: 'text-blue-600' },
  { value: 'leave_request', label: 'Leave', icon: CalendarOff, color: 'text-purple-600' },
  { value: 'general', label: 'General', icon: HelpCircle, color: 'text-slate-600' },
];

const TABS = [
  { value: 'inbox', label: 'Inbox', icon: Inbox },
  { value: 'messages', label: 'Messages', icon: MessageCircle },
  { value: 'tasks', label: 'Tasks', icon: CheckSquare },
] as const;

export default function WorkHub() {
  const { activeRole, profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'messages' | 'tasks'>('inbox');
  const [manageSubcatsOpen, setManageSubcatsOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>();
  const [inboxView, setInboxView] = useState<'inbox' | 'sent' | 'watching' | 'all'>('inbox');
  const [fabOpen, setFabOpen] = useState(false);
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const cat = searchParams.get('category') || undefined;
      setDefaultCategory(cat);
      setCreateOpen(true);
      searchParams.delete('new');
      searchParams.delete('category');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: counts } = useQuery({
    queryKey: ['workhub-badge-counts', profile?.id],
    queryFn: async () => {
      const userId = profile?.id;
      if (!userId) return { inbox: 0, overdue: 0, unread: 0 };

      const [inboxRes, overdueRes] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .eq('assignee_id', userId).in('status', ['open', 'in_progress', 'awaiting_input']),
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .eq('assignee_id', userId).eq('is_overdue', true).in('status', ['open', 'in_progress', 'awaiting_input']),
      ]);

      return { inbox: inboxRes.count || 0, overdue: overdueRes.count || 0, unread: 0 };
    },
    enabled: !!profile?.id,
    refetchInterval: 30000,
  });

  const handleQuickCreate = (category: string) => {
    setDefaultCategory(category);
    setCreateOpen(true);
  };

  return (
    <DashboardLayout>
      <PageShell title="Work Hub" description="Tickets, messages, and tasks in one place.">
        <div className="space-y-4 pb-24 md:pb-4">
          {/* Sticky tab bar (desktop) + top bar (mobile top only shows title from PageShell) */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="hidden md:flex sticky top-0 z-10 -mx-2 px-2 py-2 bg-background/95 backdrop-blur border-b border-border">
              <TabsList className="bg-muted/60 p-1 rounded-xl">
                {TABS.map(t => {
                  const Icon = t.icon;
                  const badge = t.value === 'inbox' ? counts?.inbox : t.value === 'messages' ? counts?.unread : 0;
                  return (
                    <TabsTrigger key={t.value} value={t.value} className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <Icon className="h-4 w-4" />
                      <span>{t.label}</span>
                      {(badge || 0) > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground">{badge}</Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Inbox */}
            <TabsContent value="inbox" className="mt-3 animate-fade-in">
              {/* Header row with sticky New Ticket + view selector */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                  {(['inbox', 'sent', 'watching', ...(isAdmin ? ['all'] as const : [])] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setInboxView(v)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize border transition-colors',
                        inboxView === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted',
                      )}
                    >
                      {v === 'inbox' ? 'My Inbox' : v === 'sent' ? 'Sent' : v === 'watching' ? "Watching" : 'All Tickets'}
                      {v === 'inbox' && (counts?.overdue || 0) > 0 && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-destructive/20 text-destructive px-1.5 text-[9px] font-bold">{counts?.overdue}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 shrink-0">
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setManageSubcatsOpen(true)}>
                      <Settings2 className="h-4 w-4 mr-1" /> Manage
                    </Button>
                  )}
                  <Button size="sm" onClick={() => { setDefaultCategory(undefined); setCreateOpen(true); }} className="hidden md:inline-flex">
                    <Plus className="h-4 w-4 mr-1" /> New Ticket
                  </Button>
                </div>
              </div>

              {/* Category chip filters */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-2 px-2 pb-2 mb-2">
                {QUICK_CATEGORIES.map(({ value, label, icon: Icon, color }) => (
                  <button
                    key={value}
                    onClick={() => handleQuickCreate(value)}
                    className={cn(
                      'shrink-0 h-8 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-muted transition-colors',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', color)} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <TicketList view={inboxView} userId={profile?.id} />
            </TabsContent>

            {/* Messages */}
            <TabsContent value="messages" className="mt-3 animate-fade-in">
              <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading messages…</div>}>
                <MessagesTab />
              </Suspense>
            </TabsContent>

            {/* Tasks */}
            <TabsContent value="tasks" className="mt-3 animate-fade-in">
              <TasksAndPolls />
            </TabsContent>
          </Tabs>
        </div>
      </PageShell>

      {/* Mobile bottom tab bar (Work Hub scoped) */}
      <div className="md:hidden fixed bottom-[52px] left-0 right-0 z-[190] bg-white/95 backdrop-blur border-t border-border safe-area-bottom">
        <div className="flex h-14">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.value;
            const badge = t.value === 'inbox' ? counts?.inbox : t.value === 'messages' ? counts?.unread : 0;
            return (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value as any)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 relative min-h-11',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'fill-primary/10')} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium">{t.label}</span>
                {(badge || 0) > 0 && (
                  <span className="absolute top-1 right-[calc(50%-18px)] min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-t bg-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setFabOpen(true)}
        className="md:hidden fixed bottom-[130px] right-4 z-[195] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Quick create"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Quick Create</SheetTitle></SheetHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            <button onClick={() => { setFabOpen(false); setDefaultCategory(undefined); setCreateOpen(true); }} className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:bg-muted min-h-[88px]">
              <Inbox className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">New Ticket</span>
            </button>
            <button onClick={() => { setFabOpen(false); setActiveTab('tasks'); }} className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:bg-muted min-h-[88px]">
              <CheckSquare className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">New Task</span>
            </button>
            <button onClick={() => { setFabOpen(false); setActiveTab('messages'); }} className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:bg-muted min-h-[88px]">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium">Message</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <CreateTicketDialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setDefaultCategory(undefined); }} defaultCategory={defaultCategory} onCreated={() => setInboxView('sent')} />
      <SubcategoryManager open={manageSubcatsOpen} onOpenChange={setManageSubcatsOpen} />
    </DashboardLayout>
  );
}
