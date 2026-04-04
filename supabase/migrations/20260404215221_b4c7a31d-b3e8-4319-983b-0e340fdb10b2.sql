
-- 1. Extend attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS lesson_notes text;

-- 2. Attendance Comments
CREATE TABLE public.attendance_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attendance comments they are part of" ON public.attendance_comments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.id = attendance_id AND (a.teacher_id = auth.uid() OR a.student_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can insert attendance comments" ON public.attendance_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 3. Tasks (WorkHub standalone tasks)
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  assigned_to uuid,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  deadline timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false,
  linked_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id),
  division_id uuid REFERENCES public.divisions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task participants and admins can view" ON public.tasks
  FOR SELECT TO authenticated USING (
    created_by = auth.uid() OR assigned_to = auth.uid()
    OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Authenticated users can create tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator or assignee can update tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR assigned_to = auth.uid()
    OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Creator or admin can delete tasks" ON public.tasks
  FOR DELETE TO authenticated USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Polls
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id),
  division_id uuid REFERENCES public.divisions(id),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view polls" ON public.polls
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creator can manage polls" ON public.polls
  FOR ALL TO authenticated USING (
    created_by = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );

CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view poll options" ON public.poll_options
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Poll creator can manage options" ON public.poll_options
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND (p.created_by = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())))
  );

CREATE TABLE public.poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view poll responses" ON public.poll_responses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can vote once" ON public.poll_responses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can change their vote" ON public.poll_responses
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. Chat Groups
CREATE TABLE public.chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'group',
  created_by uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  attachment_url text,
  reply_to uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat RLS: only members
CREATE OR REPLACE FUNCTION public.is_chat_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

CREATE POLICY "Chat group members and admins can view groups" ON public.chat_groups
  FOR SELECT TO authenticated USING (
    public.is_chat_member(id, auth.uid()) OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Authenticated can create chat groups" ON public.chat_groups
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Members can view membership" ON public.chat_members
  FOR SELECT TO authenticated USING (
    public.is_chat_member(group_id, auth.uid()) OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Group creator or admin can manage members" ON public.chat_members
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.chat_groups g WHERE g.id = group_id AND (g.created_by = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())))
  );

CREATE POLICY "Members can view messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (
    public.is_chat_member(group_id, auth.uid()) OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND public.is_chat_member(group_id, auth.uid())
  );

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 6. AI Insights
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'student',
  insight_text text NOT NULL,
  risk_level text NOT NULL DEFAULT 'info',
  metadata jsonb DEFAULT '{}',
  is_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights" ON public.ai_insights
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Admins can create insights" ON public.ai_insights
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Users can dismiss own insights" ON public.ai_insights
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7. Resource Assignments
CREATE TABLE public.resource_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  assigned_by uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.resource_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assignee and admins can view resource assignments" ON public.resource_assignments
  FOR SELECT TO authenticated USING (
    assigned_to = auth.uid() OR assigned_by = auth.uid()
    OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Admins and teachers can assign resources" ON public.resource_assignments
  FOR INSERT TO authenticated WITH CHECK (
    assigned_by = auth.uid()
  );
CREATE POLICY "Assigner or admin can delete assignments" ON public.resource_assignments
  FOR DELETE TO authenticated USING (
    assigned_by = auth.uid() OR public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  );

-- Indexes for performance
CREATE INDEX idx_attendance_comments_attendance ON public.attendance_comments(attendance_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_chat_messages_group ON public.chat_messages(group_id, created_at DESC);
CREATE INDEX idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX idx_ai_insights_user ON public.ai_insights(user_id, created_at DESC);
CREATE INDEX idx_poll_responses_poll ON public.poll_responses(poll_id);
CREATE INDEX idx_resource_assignments_user ON public.resource_assignments(assigned_to);
