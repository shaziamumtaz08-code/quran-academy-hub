import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Inbox, Send, Eye, LayoutGrid, Settings2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TicketList } from '@/components/hub/TicketList';
import { CreateTicketDialog } from '@/components/hub/CreateTicketDialog';
import { SubcategoryManager } from '@/components/hub/SubcategoryManager';

export default function WorkHub() {
  const { activeRole, profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');
  const [manageSubcatsOpen, setManageSubcatsOpen] = useState(false);
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

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
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New Ticket
              </Button>
            </div>
          </div>
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

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} />
      <SubcategoryManager open={manageSubcatsOpen} onOpenChange={setManageSubcatsOpen} />
    </DashboardLayout>
  );
}
