import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { LeaveRequestFields } from './LeaveRequestFields';

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: string;
  onCreated?: () => void;
}

const CATEGORIES = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'task', label: 'Task' },
  { value: 'leave_request', label: 'Leave Request' },
  { value: 'general', label: 'General' },
];

export function CreateTicketDialog({ open, onOpenChange, defaultCategory, onCreated }: CreateTicketDialogProps) {
  const { profile } = useAuth();
  const { activeDivision, activeBranch } = useDivision();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState(defaultCategory || 'general');

  // Sync defaultCategory when dialog opens
  useEffect(() => {
    if (open && defaultCategory) {
      setCategory(defaultCategory);
    }
  }, [open, defaultCategory]);
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assigneeId, setAssigneeId] = useState('');
  const [leaveMetadata, setLeaveMetadata] = useState<any>({});
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [targetRole, setTargetRole] = useState('');

  // Fetch assignee roles when assignee changes
  const { data: assigneeRoles = [] } = useQuery({
    queryKey: ['assignee-roles', assigneeId],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', assigneeId);
      return (data || []).map((r: any) => r.role as string);
    },
    enabled: !!assigneeId && open,
  });

  // Auto-select role if assignee has only one
  useEffect(() => {
    if (assigneeRoles.length === 1) {
      setTargetRole(assigneeRoles[0]);
    } else if (assigneeRoles.length === 0) {
      setTargetRole('');
    }
  }, [assigneeRoles]);

  // Fetch subcategories
  const { data: subcategories = [] } = useQuery({
    queryKey: ['ticket-subcategories'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_subcategories').select('*').eq('is_active', true).order('sort_order');
      return data || [];
    },
    enabled: open,
  });

  // Fetch users for assignee picker
  const { data: users = [] } = useQuery({
    queryKey: ['hub-users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email').order('full_name');
      return data || [];
    },
    enabled: open,
  });

  // Fetch TAT defaults
  const { data: tatDefaults = [] } = useQuery({
    queryKey: ['tat-defaults'],
    queryFn: async () => {
      const { data } = await supabase.from('tat_defaults').select('*');
      return data || [];
    },
    enabled: open,
  });

  const filteredSubcats = subcategories.filter((sc: any) => sc.category === category);

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategoryId('');
    setLeaveMetadata({});
    if (!['complaint', 'feedback', 'suggestion'].includes(category)) {
      setIsAnonymous(false);
    }
  }, [category]);

  const createTicket = useMutation({
    mutationFn: async () => {
      // Calculate TAT
      const selectedSubcat = subcategories.find((sc: any) => sc.id === subcategoryId);
      const tatDefault = tatDefaults.find((td: any) => td.category === category && td.priority === priority);
      const tatHours = selectedSubcat?.tat_override_hours || tatDefault?.tat_hours || 48;
      const tatDeadline = new Date(Date.now() + tatHours * 60 * 60 * 1000).toISOString();

      const metadata = category === 'leave_request' ? leaveMetadata : {};

      const finalAssigneeId = assigneeId || profile!.id;

      const { error } = await supabase.from('tickets').insert({
        creator_id: profile!.id,
        assignee_id: finalAssigneeId,
        category,
        subcategory_id: subcategoryId || null,
        subject,
        description,
        priority,
        tat_hours: tatHours,
        tat_deadline: tatDeadline,
        due_date: tatDeadline,
        metadata,
        is_anonymous: isAnonymous,
        branch_id: activeBranch?.id || null,
        division_id: activeDivision?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ticket created successfully');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['workhub-tab-counts'] });
      resetForm();
      onOpenChange(false);
      onCreated?.();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create ticket'),
  });

  const resetForm = () => {
    setCategory('general');
    setSubcategoryId('');
    setSubject('');
    setDescription('');
    setPriority('normal');
    setAssigneeId('');
    setLeaveMetadata({});
    setIsAnonymous(false);
  };

  const canSubmit = subject.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category & Subcategory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Subcategory</Label>
              <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {filteredSubcats.map((sc: any) => (
                    <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority & Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assign To</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <Label className="text-xs">Subject</Label>
            <Input placeholder="Brief title..." value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea placeholder="Details..." value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px]" />
          </div>

          {/* Anonymous Toggle */}
          {['complaint', 'feedback', 'suggestion'].includes(category) && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Submit Anonymously</p>
                <p className="text-xs text-muted-foreground">Your identity will be hidden from the recipient</p>
              </div>
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>
          )}

          {/* Leave Request Fields */}
          {category === 'leave_request' && (
            <LeaveRequestFields metadata={leaveMetadata} onChange={setLeaveMetadata} />
          )}

          <Button className="w-full" disabled={!canSubmit || createTicket.isPending} onClick={() => createTicket.mutate()}>
            {createTicket.isPending ? 'Creating...' : 'Create Ticket'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
