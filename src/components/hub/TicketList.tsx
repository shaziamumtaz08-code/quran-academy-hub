import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, Clock, AlertTriangle, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { TicketDetail } from './TicketDetail';
import { TATIndicator } from './TATIndicator';

interface TicketListProps {
  view: 'inbox' | 'sent' | 'watching' | 'all';
  userId?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  complaint: 'bg-destructive/10 text-destructive border-destructive/20',
  feedback: 'bg-accent/10 text-accent border-accent/20',
  suggestion: 'bg-warning/10 text-warning border-warning/20',
  task: 'bg-primary/10 text-primary border-primary/20',
  leave_request: 'bg-success/10 text-success border-success/20',
  general: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  high: 'bg-warning text-warning-foreground',
  normal: 'bg-secondary text-secondary-foreground',
  low: 'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-accent/10 text-accent',
  in_progress: 'bg-warning/10 text-warning',
  awaiting_input: 'bg-primary/10 text-primary',
  resolved: 'bg-success/10 text-success',
  closed: 'bg-muted text-muted-foreground',
  escalated: 'bg-destructive/10 text-destructive',
};

export function TicketList({ view, userId }: TicketListProps) {
  const { activeRole } = useAuth();
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['tickets', view, userId],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select(`*, subcategory:ticket_subcategories(id, name, category)`)
        .order('created_at', { ascending: false });

      if (view === 'inbox' && userId) {
        query = query.eq('assignee_id', userId);
      } else if (view === 'sent' && userId) {
        query = query.eq('creator_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let allData = data || [];

      // Filter watching view BEFORE enrichment
      if (view === 'watching' && userId) {
        const { data: watchedIds } = await supabase
          .from('ticket_watchers')
          .select('ticket_id')
          .eq('user_id', userId);
        const ids = new Set((watchedIds || []).map(w => w.ticket_id));
        allData = allData.filter((t: any) => ids.has(t.id));
      }

      // Enrich ALL views with profile names
      const userIds = [...new Set(allData.flatMap((t: any) =>
        [t.creator_id, t.assignee_id].filter(Boolean)
      ))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
        allData = allData.map((t: any) => ({
          ...t,
          creator_name: profileMap[t.creator_id] || 'Unknown',
          assignee_name: profileMap[t.assignee_id] || 'Unknown',
        }));
      }

      return allData;
    },
    enabled: !!userId || view === 'all',
  });

  const filteredTickets = tickets.filter((t: any) => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return t.subject?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) ||
        `TKT-${t.ticket_number}`.toLowerCase().includes(q);
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 h-20" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="feedback">Feedback</SelectItem>
            <SelectItem value="suggestion">Suggestion</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="leave_request">Leave Request</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="awaiting_input">Awaiting Input</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ticket List */}
      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No tickets found</p>
            <p className="text-sm mt-1">
              {view === 'inbox' ? 'Nothing assigned to you yet.' :
               view === 'sent' ? 'You haven\'t created any tickets.' :
               'No tickets match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map((ticket: any) => (
            <Card
              key={ticket.id}
              className="card-interactive cursor-pointer hover:shadow-card-hover transition-all"
              onClick={() => setSelectedTicketId(ticket.id)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  {/* Overdue indicator */}
                  <div className="pt-1">
                    {ticket.is_overdue ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">TKT-{ticket.ticket_number}</span>
                      <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[ticket.category] || ''}`}>
                        {ticket.category?.replace('_', ' ')}
                      </Badge>
                      <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority] || ''}`}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[ticket.status] || ''}`}>
                        {ticket.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <h4 className="font-medium text-sm mt-1 truncate">{ticket.subject}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                      {view === 'inbox' ? `From: ${ticket.creator_name}` :
                         `To: ${ticket.assignee_name}`}
                      </span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span>
                      {ticket.subcategory && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{ticket.subcategory.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <TATIndicator deadline={ticket.tat_deadline} isOverdue={ticket.is_overdue} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          open={!!selectedTicketId}
          onOpenChange={(open) => { if (!open) { setSelectedTicketId(null); refetch(); } }}
        />
      )}
    </>
  );
}
