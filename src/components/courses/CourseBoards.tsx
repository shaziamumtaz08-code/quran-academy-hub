import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Megaphone, MessageCircle, Inbox, Plus, Pin, Flag, Send,
  Clock, User, ChevronDown, Sparkles, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

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
  reply_count?: number;
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

interface CourseBoardsProps {
  courseId: string;
  isAdmin?: boolean;
}

export function CourseBoards({ courseId, isAdmin }: CourseBoardsProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [tab, setTab] = useState('announcements');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [replyText, setReplyText] = useState('');

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('announcement');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['course-posts', courseId, tab],
    queryFn: async () => {
      const typeMap: Record<string, string> = {
        announcements: 'announcement',
        discussions: 'discussion',
        support: 'support',
      };
      const { data, error } = await supabase.from('course_posts')
        .select('*, author:profiles!course_posts_author_id_fkey(full_name)')
        .eq('course_id', courseId)
        .eq('post_type', typeMap[tab] || 'announcement')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get reply counts
      const postIds = (data || []).map(p => p.id);
      if (postIds.length) {
        const { data: replies } = await supabase.from('course_post_replies')
          .select('post_id')
          .in('post_id', postIds);
        const countMap: Record<string, number> = {};
        (replies || []).forEach(r => { countMap[r.post_id] = (countMap[r.post_id] || 0) + 1; });
        return (data || []).map(p => ({ ...p, reply_count: countMap[p.id] || 0 })) as Post[];
      }
      return (data || []).map(p => ({ ...p, reply_count: 0 })) as Post[];
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ['post-replies', selectedPost?.id],
    enabled: !!selectedPost,
    queryFn: async () => {
      const { data, error } = await supabase.from('course_post_replies')
        .select('*, author:profiles!course_post_replies_author_id_fkey(full_name)')
        .eq('post_id', selectedPost!.id)
        .order('created_at');
      if (error) throw error;
      return (data || []) as Reply[];
    },
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_posts').insert({
        course_id: courseId,
        author_id: profile!.id,
        post_type: formType,
        title: formTitle.trim(),
        content: formContent || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-posts', courseId] });
      setCreateOpen(false);
      setFormTitle(''); setFormContent('');
      toast({ title: 'Post created' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const createReply = useMutation({
    mutationFn: async () => {
      if (!selectedPost || !replyText.trim()) return;
      const { error } = await supabase.from('course_post_replies').insert({
        post_id: selectedPost.id,
        author_id: profile!.id,
        content: replyText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-replies', selectedPost?.id] });
      queryClient.invalidateQueries({ queryKey: ['course-posts', courseId] });
      setReplyText('');
      toast({ title: 'Reply posted' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const togglePin = useMutation({
    mutationFn: async (post: Post) => {
      const { error } = await supabase.from('course_posts').update({ is_pinned: !post.is_pinned }).eq('id', post.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-posts', courseId] }),
  });

  const flagPost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('course_posts').update({ is_flagged: true, flag_reason: 'Flagged for review' }).eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-posts', courseId] });
      toast({ title: 'Post flagged for review' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="announcements" className="text-xs gap-1"><Megaphone className="h-3.5 w-3.5" /> Announcements</TabsTrigger>
            <TabsTrigger value="discussions" className="text-xs gap-1"><MessageCircle className="h-3.5 w-3.5" /> Discussions</TabsTrigger>
            <TabsTrigger value="support" className="text-xs gap-1"><Inbox className="h-3.5 w-3.5" /> Support</TabsTrigger>
          </TabsList>
        </Tabs>
        {(isAdmin || tab === 'discussions') && (
          <Button size="sm" onClick={() => {
            setFormType(tab === 'announcements' ? 'announcement' : tab === 'support' ? 'support' : 'discussion');
            setCreateOpen(true);
          }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Post
          </Button>
        )}
      </div>

      {/* Posts List */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          No posts yet. Start the conversation!
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <Card key={post.id} className={cn(
              "cursor-pointer hover:shadow-sm transition-shadow border-border/50",
              post.is_pinned && "border-accent/40 bg-accent/5",
              post.is_flagged && "border-destructive/30 bg-destructive/5"
            )} onClick={() => setSelectedPost(post)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {(post.author?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {post.is_pinned && <Pin className="h-3 w-3 text-accent" />}
                      {post.is_flagged && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      <h4 className="font-medium text-sm truncate">{post.title}</h4>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{post.author?.full_name}</span>
                      <span>{format(new Date(post.created_at), 'MMM d, h:mm a')}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {post.reply_count}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              {selectedPost?.is_pinned && <Pin className="h-4 w-4 text-accent" />}
              {selectedPost?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedPost?.author?.full_name} • {selectedPost && format(new Date(selectedPost.created_at), 'PPp')}
            </DialogDescription>
          </DialogHeader>
          {selectedPost?.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
          )}
          {isAdmin && selectedPost && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => togglePin.mutate(selectedPost)}>
                <Pin className="h-3.5 w-3.5 mr-1" /> {selectedPost.is_pinned ? 'Unpin' : 'Pin'}
              </Button>
              {!selectedPost.is_flagged && (
                <Button variant="outline" size="sm" onClick={() => flagPost.mutate(selectedPost.id)}>
                  <Flag className="h-3.5 w-3.5 mr-1" /> Flag
                </Button>
              )}
            </div>
          )}
          <Separator />
          {/* Replies */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {replies.map(reply => (
              <div key={reply.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  {(reply.author?.full_name || 'U').charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{reply.author?.full_name} • {format(new Date(reply.created_at), 'MMM d, h:mm a')}</div>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{reply.content}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Reply input */}
          <div className="flex gap-2 pt-2 border-t">
            <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" className="flex-1"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createReply.mutate(); } }} />
            <Button size="sm" onClick={() => createReply.mutate()} disabled={!replyText.trim() || createReply.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Post Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New {formType === 'announcement' ? 'Announcement' : formType === 'support' ? 'Support Request' : 'Discussion'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createPost.mutate()} disabled={createPost.isPending || !formTitle.trim()}>
              {createPost.isPending ? 'Posting…' : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
