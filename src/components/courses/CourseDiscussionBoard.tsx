import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Plus, Pin, Flag, Send, MessageCircle, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  course_id: string;
  author_id: string;
  post_type: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  is_approved: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  author?: { full_name: string } | null;
  replies?: { count: number }[];
}

interface Reply {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_approved: boolean;
  is_flagged: boolean;
  created_at: string;
  author?: { full_name: string } | null;
}

interface CourseDiscussionBoardProps {
  courseId: string;
  currentUserId: string;
  isAdmin?: boolean;
}

const POST_TYPES = ['all', 'announcement', 'discussion', 'support', 'question'] as const;

function ReplyForm({ postId, userId, onSuccess }: { postId: string; userId: string; onSuccess: () => void }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('course_post_replies').insert({
      post_id: postId,
      author_id: userId,
      content: text.trim(),
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setText('');
      onSuccess();
    }
    setSubmitting(false);
  };

  return (
    <div className="flex gap-2 pt-3 border-t border-border/50">
      <Input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write a reply…"
        className="flex-1"
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
      />
      <Button size="sm" onClick={handleSubmit} disabled={!text.trim() || submitting}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CourseDiscussionBoard({ courseId, currentUserId, isAdmin }: CourseDiscussionBoardProps) {
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<string>('all');
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('discussion');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['course-discussion-posts', courseId, activeType],
    queryFn: async () => {
      let query = supabase.from('course_posts')
        .select('*, author:profiles!course_posts_author_id_fkey(full_name), replies:course_post_replies(count)')
        .eq('course_id', courseId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (activeType !== 'all') query = query.eq('post_type', activeType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Post[];
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ['discussion-replies', expandedPost],
    queryFn: async () => {
      const { data, error } = await supabase.from('course_post_replies')
        .select('*, author:profiles!course_post_replies_author_id_fkey(full_name)')
        .eq('post_id', expandedPost!)
        .order('created_at');
      if (error) throw error;
      return (data || []) as Reply[];
    },
    enabled: !!expandedPost,
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_posts').insert({
        course_id: courseId,
        author_id: currentUserId,
        post_type: formType,
        title: formTitle.trim(),
        content: formContent || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-discussion-posts', courseId] });
      setNewPostOpen(false);
      setFormTitle(''); setFormContent('');
      toast({ title: 'Post created' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const togglePin = useMutation({
    mutationFn: async (post: Post) => {
      const { error } = await supabase.from('course_posts').update({ is_pinned: !post.is_pinned }).eq('id', post.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-discussion-posts', courseId] }),
  });

  const flagPost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('course_posts').update({ is_flagged: true, flag_reason: 'Flagged for review' }).eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-discussion-posts', courseId] });
      toast({ title: 'Post flagged for review' });
    },
  });

  const invalidateReplies = () => {
    queryClient.invalidateQueries({ queryKey: ['discussion-replies', expandedPost] });
    queryClient.invalidateQueries({ queryKey: ['course-discussion-posts', courseId] });
  };

  const replyCount = (post: Post) => (post.replies as any)?.[0]?.count || 0;

  return (
    <div className="space-y-4">
      {/* Type filter + New Post */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {POST_TYPES.map(t => (
            <Button key={t} size="sm" variant={activeType === t ? 'default' : 'outline'}
              onClick={() => setActiveType(t)} className="text-xs shrink-0">
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setNewPostOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Post
        </Button>
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          No posts yet. Start the conversation!
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {posts.map(post => {
            const isExpanded = expandedPost === post.id;
            return (
              <Card key={post.id} className={cn(
                "cursor-pointer hover:shadow-sm transition-shadow border-border/50",
                post.is_pinned && "border-accent/40 bg-accent/5",
                post.is_flagged && "border-destructive/30 bg-destructive/5"
              )} onClick={() => setExpandedPost(isExpanded ? null : post.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {(post.author?.full_name || 'U').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.is_pinned && <Badge variant="secondary" className="text-xs">Pinned</Badge>}
                        {post.is_flagged && <AlertTriangle className="h-3 w-3 text-destructive" />}
                        <Badge variant="outline" className="text-xs">{post.post_type}</Badge>
                        <h4 className="font-medium text-sm truncate">{post.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {post.author?.full_name} · {formatDistanceToNow(new Date(post.created_at))} ago · {replyCount(post)} replies
                      </p>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50" onClick={e => e.stopPropagation()}>
                      {post.content && (
                        <p className="text-sm whitespace-pre-wrap mb-4 leading-relaxed">{post.content}</p>
                      )}

                      {/* Admin actions */}
                      {isAdmin && (
                        <div className="flex gap-2 mb-4">
                          <Button variant="outline" size="sm" onClick={() => togglePin.mutate(post)}>
                            <Pin className="h-3.5 w-3.5 mr-1" /> {post.is_pinned ? 'Unpin' : 'Pin'}
                          </Button>
                          {!post.is_flagged && (
                            <Button variant="outline" size="sm" onClick={() => flagPost.mutate(post.id)}>
                              <Flag className="h-3.5 w-3.5 mr-1" /> Flag
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Replies */}
                      <div className="space-y-3 mb-3">
                        {replies.map(r => (
                          <div key={r.id} className="pl-4 border-l-2 border-border/50">
                            <p className="text-sm">{r.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {r.author?.full_name} · {formatDistanceToNow(new Date(r.created_at))} ago
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Reply form */}
                      <ReplyForm postId={post.id} userId={currentUserId} onSuccess={invalidateReplies} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Post Dialog */}
      <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Post</DialogTitle>
            <DialogDescription>Share an announcement, start a discussion, or ask for support.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(!isAdmin ? ['discussion', 'question', 'support'] : ['announcement', 'discussion', 'question', 'support']).map(t => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Post title" />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Write your post…" rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPostOpen(false)}>Cancel</Button>
            <Button onClick={() => createPost.mutate()} disabled={createPost.isPending || !formTitle.trim()}>
              {createPost.isPending ? 'Posting…' : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
