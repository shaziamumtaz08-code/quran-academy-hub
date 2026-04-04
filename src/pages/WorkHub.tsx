import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Inbox, Send, Eye, LayoutGrid, Settings2, MessageSquareWarning, ThumbsUp, Lightbulb, ClipboardList, CalendarOff, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TicketList } from '@/components/hub/TicketList';
import { CreateTicketDialog } from '@/components/hub/CreateTicketDialog';
import { SubcategoryManager } from '@/components/hub/SubcategoryManager';
import TasksAndPolls from '@/components/hub/TasksAndPolls';

const QUICK_CATEGORIES = [
  { value: 'complaint', label: 'Complaint', icon: MessageSquareWarning, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-100 dark:border-red-900/40', iconBg: 'bg-red-100 dark:bg-red-900/50' },
  { value: 'feedback', label: 'Feedback', icon: ThumbsUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-100 dark:border-emerald-900/40', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50' },
  { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-100 dark:border-amber-900/40', iconBg: 'bg-amber-100 dark:bg-amber-900/50' },
  { value: 'task', label: 'Task', icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-100 dark:border-blue-900/40', iconBg: 'bg-blue-100 dark:bg-blue-900/50' },
  { value: 'leave_request', label: 'Leave', icon: CalendarOff, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-100 dark:border-purple-900/40', iconBg: 'bg-purple-100 dark:bg-purple-900/50' },
  { value: 'general', label: 'General', icon: HelpCircle, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-100 dark:border-slate-900/40', iconBg: 'bg-slate-100 dark:bg-slate-900/50' },
];

export default function WorkHub() {
  const { activeRole, profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const [manageSubcatsOpen, setManageSubcatsOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>();
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

  // Tab badge counts
  const { data: tabCounts } = useQuery({
    queryKey: ['workhub-tab-counts', profile?.id],
    queryFn: async () => {
      const userId = profile?.id;
      if (!userId) return { inbox: 0, sent: 0, overdue: 0 };

      const { count: inboxCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', userId)
        .in('status', ['open', 'in_progress', 'awaiting_input']);

      const { count: sentCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', userId);

      const { count: overdueCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', userId)
        .eq('is_overdue', true)
        .in('status', ['open', 'in_progress', 'awaiting_input']);

      return { inbox: inboxCount || 0, sent: sentCount || 0, overdue: overdueCount || 0 };
    },
    enabled: !!profile?.id,
  });

  const handleQuickCreate = (category: string) => {
    setDefaultCategory(category);
    setCreateOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--accent))] p-5 sm:p-6 text-white">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Work Hub</h1>
              <p className="text-sm opacity-80 mt-0.5">Tickets, tasks, leave requests & feedback — all in one place</p>
              <div className="flex items-center gap-2 mt-2">
                {(tabCounts?.overdue || 0) > 0 && (
                  <Badge className="bg-destructive/90 text-destructive-foreground text-xs">{tabCounts?.overdue} overdue</Badge>
                )}
                {(tabCounts?.inbox || 0) > 0 && (
                  <Badge className="bg-white/10 text-white border-white/20 text-xs">{tabCounts?.inbox} pending action</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setManageSubcatsOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  Manage
                </Button>
              )}
              <Button size="sm" className="bg-white text-[hsl(var(--navy))] font-bold hover:bg-white/90" onClick={() => { setDefaultCategory(undefined); setCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                New Ticket
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Category Cards */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {QUICK_CATEGORIES.map(({ value, label, icon: Icon, color, bg, border, iconBg }) => (
            <button
              key={value}
              onClick={() => handleQuickCreate(value)}
              className={`group flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-2xl ${bg} border ${border} hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200`}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
              </div>
              <span className={`text-[11px] sm:text-xs font-semibold ${color}`}>{label}</span>
            </button>
          ))}
        </div>

        {/* Pill Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto w-full lg:w-auto lg:inline-flex">
            <TabsTrigger value="inbox" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">My Inbox</span>
              <span className="sm:hidden">Inbox</span>
              {(tabCounts?.inbox || 0) > 0 && (
                <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-accent text-accent-foreground">{tabCounts?.inbox}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Send className="h-4 w-4" />
              <span>Sent</span>
              {(tabCounts?.sent || 0) > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{tabCounts?.sent}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="watching" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Watching</span>
              <span className="sm:hidden">CC'd</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="all" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">All Tickets</span>
                <span className="sm:hidden">All</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="inbox" className="mt-4">
            <TicketList view="inbox" userId={profile?.id} />
          </TabsContent>
          <TabsContent value="sent" className="mt-4" forceMount style={{ display: activeTab === 'sent' ? undefined : 'none' }}>
            <TicketList view="sent" userId={profile?.id} />
          </TabsContent>
          <TabsContent value="watching" className="mt-4">
            <TicketList view="watching" userId={profile?.id} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="all" className="mt-4">
              <TicketList view="all" userId={profile?.id} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <CreateTicketDialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setDefaultCategory(undefined); }} defaultCategory={defaultCategory} onCreated={() => setActiveTab('sent')} />
      <SubcategoryManager open={manageSubcatsOpen} onOpenChange={setManageSubcatsOpen} />
    </DashboardLayout>
  );
}
