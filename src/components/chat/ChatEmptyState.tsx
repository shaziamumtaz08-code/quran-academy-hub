import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, ClipboardList, Sparkles, Paperclip, Users } from 'lucide-react';

interface ChatEmptyStateProps {
  group: any;
  members: any[];
  onAddMembers: () => void;
  onCreateTask: () => void;
  onAskAI: () => void;
  onShareFile: () => void;
}

const typeDescriptions: Record<string, string> = {
  project: 'project collaboration and updates',
  issue: 'tracking and resolving issues',
  salary: 'salary discussions and queries',
  custom: 'team communication',
};

const typeIcons: Record<string, string> = { project: '📋', issue: '🐛', salary: '💰', custom: '💬' };

export function ChatEmptyState({ group, members, onAddMembers, onCreateTask, onAskAI, onShareFile }: ChatEmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
          {typeIcons[group.type] || '💬'}
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{group.name}</h3>
          <Badge variant="secondary" className="text-[10px] capitalize mt-1">{group.type}</Badge>
          <p className="text-sm text-muted-foreground mt-2">
            This is a <span className="font-medium text-foreground">{group.type}</span> group for {typeDescriptions[group.type] || 'collaboration'}.
          </p>
        </div>

        {members.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-3 w-3" /> {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center justify-center -space-x-2">
              {members.slice(0, 6).map((m: any) => (
                <Avatar key={m.id} className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                    {(m.full_name || '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length > 6 && (
                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  +{members.length - 6}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={onAddMembers}>
            <UserPlus className="h-3.5 w-3.5" /> Add Members
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={onCreateTask}>
            <ClipboardList className="h-3.5 w-3.5" /> Create Task
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={onAskAI}>
            <Sparkles className="h-3.5 w-3.5" /> Ask AI
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={onShareFile}>
            <Paperclip className="h-3.5 w-3.5" /> Share File
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">Start a conversation or use quick actions above</p>
      </div>
    </div>
  );
}
