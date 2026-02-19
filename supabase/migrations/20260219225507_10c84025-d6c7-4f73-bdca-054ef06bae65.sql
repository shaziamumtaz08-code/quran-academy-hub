
-- ============================================================
-- WORK HUB: 6 tables + RLS + seed data
-- ============================================================

-- 1. Projects (optional ticket grouping)
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  branch_id uuid REFERENCES public.branches(id),
  division_id uuid REFERENCES public.divisions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all projects" ON public.projects FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view projects they are involved in" ON public.projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Ticket Subcategories (config table)
CREATE TABLE public.ticket_subcategories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  tat_override_hours integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view subcategories" ON public.ticket_subcategories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage subcategories" ON public.ticket_subcategories FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- 3. TAT Defaults (SLA config)
CREATE TABLE public.tat_defaults (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  tat_hours integer NOT NULL DEFAULT 48,
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tat_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view TAT defaults" ON public.tat_defaults FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage TAT defaults" ON public.tat_defaults FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- 4. Tickets (core entity)
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number serial,
  project_id uuid REFERENCES public.projects(id),
  creator_id uuid NOT NULL,
  assignee_id uuid NOT NULL,
  subcategory_id uuid REFERENCES public.ticket_subcategories(id),
  category text NOT NULL DEFAULT 'general',
  subject text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  due_date timestamptz,
  tat_hours integer,
  tat_deadline timestamptz,
  is_overdue boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  branch_id uuid REFERENCES public.branches(id),
  division_id uuid REFERENCES public.divisions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin can manage all tickets" ON public.tickets FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Users can view tickets they created
CREATE POLICY "Users can view own created tickets" ON public.tickets FOR SELECT
  USING (creator_id = auth.uid());

-- Users can view tickets assigned to them
CREATE POLICY "Users can view assigned tickets" ON public.tickets FOR SELECT
  USING (assignee_id = auth.uid());

-- Authenticated users can create tickets
CREATE POLICY "Authenticated users can create tickets" ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND creator_id = auth.uid());

-- Assignees can update ticket status
CREATE POLICY "Assignees can update their tickets" ON public.tickets FOR UPDATE
  USING (assignee_id = auth.uid());

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_tickets_assignee ON public.tickets(assignee_id);
CREATE INDEX idx_tickets_creator ON public.tickets(creator_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_category ON public.tickets(category);

-- 5. Ticket Comments (thread/replies)
CREATE TABLE public.ticket_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  message text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  marked_user_id uuid,
  attachment_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all comments" ON public.ticket_comments FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- Users can view non-internal comments on tickets they can see
CREATE POLICY "Users can view comments on their tickets" ON public.ticket_comments FOR SELECT
  USING (
    (is_internal = false) AND
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.creator_id = auth.uid() OR t.assignee_id = auth.uid())
    )
  );

-- Users can insert comments on tickets they are part of
CREATE POLICY "Users can comment on their tickets" ON public.ticket_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.creator_id = auth.uid() OR t.assignee_id = auth.uid())
    )
  );

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments(ticket_id);

-- 6. Ticket Watchers (CC list)
CREATE TABLE public.ticket_watchers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

ALTER TABLE public.ticket_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all watchers" ON public.ticket_watchers FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view watchers on their tickets" ON public.ticket_watchers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.creator_id = auth.uid() OR t.assignee_id = auth.uid())
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Ticket participants can add watchers" ON public.ticket_watchers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.creator_id = auth.uid() OR t.assignee_id = auth.uid())
    )
  );

-- Watchers can view tickets they watch
CREATE POLICY "Watchers can view watched tickets" ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ticket_watchers tw
      WHERE tw.ticket_id = id AND tw.user_id = auth.uid()
    )
  );

-- Parents can view children's tickets
CREATE POLICY "Parents can view children tickets" ON public.tickets FOR SELECT
  USING (
    has_role(auth.uid(), 'parent') AND (
      creator_id IN (SELECT get_parent_children_ids(auth.uid()))
      OR assignee_id IN (SELECT get_parent_children_ids(auth.uid()))
    )
  );

CREATE INDEX idx_ticket_watchers_user ON public.ticket_watchers(user_id);

-- ============================================================
-- SEED DATA: Subcategories
-- ============================================================
INSERT INTO public.ticket_subcategories (category, name, sort_order, tat_override_hours) VALUES
  -- Complaint
  ('complaint', 'Teaching Quality', 1, NULL),
  ('complaint', 'Schedule Issue', 2, NULL),
  ('complaint', 'Billing Dispute', 3, NULL),
  ('complaint', 'Technical Problem', 4, NULL),
  ('complaint', 'Behavior Concern', 5, NULL),
  ('complaint', 'Other', 6, NULL),
  -- Feedback
  ('feedback', 'Monthly Parent Feedback', 1, 168),
  ('feedback', 'Teacher Performance', 2, NULL),
  ('feedback', 'Curriculum', 3, NULL),
  ('feedback', 'Platform/App', 4, NULL),
  ('feedback', 'General', 5, NULL),
  -- Suggestion
  ('suggestion', 'Schedule Improvement', 1, NULL),
  ('suggestion', 'Curriculum Enhancement', 2, NULL),
  ('suggestion', 'Fee Structure', 3, NULL),
  ('suggestion', 'Feature Request', 4, NULL),
  ('suggestion', 'Other', 5, NULL),
  -- Task
  ('task', 'Administrative', 1, NULL),
  ('task', 'Academic', 2, NULL),
  ('task', 'Follow-up', 3, NULL),
  ('task', 'Documentation', 4, NULL),
  ('task', 'Coordination', 5, NULL),
  ('task', 'Other', 6, NULL),
  -- Leave Request
  ('leave_request', 'Sick Leave', 1, 24),
  ('leave_request', 'Personal Leave', 2, 48),
  ('leave_request', 'Emergency', 3, 4),
  ('leave_request', 'Planned Vacation', 4, 168),
  ('leave_request', 'Religious/Holiday', 5, 72),
  ('leave_request', 'Pregnancy Leave', 6, 168),
  ('leave_request', 'Hajj Leave', 7, 168),
  ('leave_request', 'Umrah Leave', 8, 168),
  -- General
  ('general', 'Query', 1, NULL),
  ('general', 'Information Request', 2, NULL),
  ('general', 'Update', 3, NULL),
  ('general', 'Other', 4, NULL);

-- ============================================================
-- SEED DATA: TAT Defaults
-- ============================================================
INSERT INTO public.tat_defaults (category, priority, tat_hours) VALUES
  ('complaint', 'urgent', 4),
  ('complaint', 'high', 12),
  ('complaint', 'normal', 24),
  ('complaint', 'low', 48),
  ('feedback', 'urgent', 12),
  ('feedback', 'high', 24),
  ('feedback', 'normal', 48),
  ('feedback', 'low', 72),
  ('suggestion', 'urgent', 24),
  ('suggestion', 'high', 48),
  ('suggestion', 'normal', 72),
  ('suggestion', 'low', 168),
  ('task', 'urgent', 4),
  ('task', 'high', 12),
  ('task', 'normal', 24),
  ('task', 'low', 48),
  ('leave_request', 'urgent', 4),
  ('leave_request', 'high', 24),
  ('leave_request', 'normal', 48),
  ('leave_request', 'low', 72),
  ('general', 'urgent', 12),
  ('general', 'high', 24),
  ('general', 'normal', 48),
  ('general', 'low', 72);
