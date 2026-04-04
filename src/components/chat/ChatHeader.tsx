import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Users, Sparkles, Paperclip } from 'lucide-react';

const typeIcons: Record<string, string> = { project: '📋', issue: '🐛', salary: '💰', custom: '💬' };

interface ChatHeaderProps {
  group: any;
  memberCount: number;
  onBack: () => void;
  onViewMembers: () => void;
  onAI: () => void;
  onAttach: () => void;
}

export function ChatHeader({ group, memberCount, onBack, onViewMembers, onAI, onAttach }: ChatHeaderProps) {
  return (
    <div className="h-14 border-b border-border flex items-center px-3 gap-2.5 bg-card shrink-0">
      <button className="md:hidden p-1" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </button>
      <Avatar className="h-9 w-9">
        <AvatarFallback className="text-sm bg-primary/10 text-primary font-bold">
          {typeIcons[group.type] || '💬'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground truncate">{group.name}</p>
        <p className="text-[10px] text-muted-foreground">{memberCount} member{memberCount !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onViewMembers} title="Members">
          <Users className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onAI} title="AI Assistant">
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onAttach} title="Attach file">
          <Paperclip className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
