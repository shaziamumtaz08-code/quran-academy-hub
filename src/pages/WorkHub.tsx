import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Inbox, Send, Eye, LayoutGrid, Settings2, MessageSquareWarning, ThumbsUp, Lightbulb, ClipboardList, CalendarOff, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TicketList } from '@/components/hub/TicketList';
import { CreateTicketDialog } from '@/components/hub/CreateTicketDialog';
import { SubcategoryManager } from '@/components/hub/SubcategoryManager';

const QUICK_CATEGORIES = [
  { value: 'complaint', label: 'Complaint', icon: MessageSquareWarning, gradient: 'from-red-500/80 to-rose-600/80' },
  { value: 'feedback', label: 'Feedback', icon: ThumbsUp, gradient: 'from-emerald-500/80 to-teal-600/80' },
  { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, gradient: 'from-amber-500/80 to-yellow-600/80' },
  { value: 'task', label: 'Task', icon: ClipboardList, gradient: 'from-blue-500/80 to-indigo-600/80' },
  { value: 'leave_request', label: 'Leave', icon: CalendarOff, gradient: 'from-purple-500/80 to-violet-600/80' },
  { value: 'general', label: 'General', icon: HelpCircle, gradient: 'from-slate-500/80 to-gray-600/80' },
];

export default function WorkHub() {
  const { activeRole, profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const [manageSubcatsOpen, setManageSubcatsOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>();
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

  const handleQuickCreate = (category: string) => {
    setDefaultCategory(category);
    setCreateOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="page-header-premium text-primary-foreground">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Work Hub</h1>
              <p className="text-sm opacity-80">Tickets, tasks, leave requests & feedback — all in one place</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setManageSubcatsOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  Manage
                </Button>
              )}
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { setDefaultCategory(undefined); setCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                New Ticket
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Category Buttons */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {QUICK_CATEGORIES.map(({ value, label, icon: Icon, gradient }) => (
            <button
              key={value}
              onClick={() => handleQuickCreate(value)}
              className={`group relative flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm hover:shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 overflow-hidden`}
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
              <Icon className="h-5 w-5 sm:h-6 sm:w-6 relative z-10 drop-shadow-sm" />
              <span className="text-[11px] sm:text-xs font-semibold tracking-wide relative z-10 drop-shadow-sm">{label}</span>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="inbox" className="gap-1.5">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">My Inbox</span>
              <span className="sm:hidden">Inbox</span>
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-1.5">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Sent</span>
              <span className="sm:hidden">Sent</span>
            </TabsTrigger>
            <TabsTrigger value="watching" className="gap-1.5">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Watching</span>
              <span className="sm:hidden">CC'd</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="all" className="gap-1.5">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">All Tickets</span>
                <span className="sm:hidden">All</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="inbox" className="mt-4">
            <TicketList view="inbox" userId={profile?.id} />
          </TabsContent>
          <TabsContent value="sent" className="mt-4">
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

      <CreateTicketDialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setDefaultCategory(undefined); }} defaultCategory={defaultCategory} />
      <SubcategoryManager open={manageSubcatsOpen} onOpenChange={setManageSubcatsOpen} />
    </DashboardLayout>
  );
}
