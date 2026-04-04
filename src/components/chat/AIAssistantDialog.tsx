import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquareText, ClipboardList, GitBranch } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AIAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: any[];
}

export function AIAssistantDialog({ open, onOpenChange, messages }: AIAssistantDialogProps) {
  const handleAction = (action: string) => {
    toast({ title: `AI: ${action}`, description: 'This feature requires AI gateway integration.' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle className="text-sm">AI Assistant</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Analyze {messages.length} messages in this chat</p>
        <div className="space-y-2 pt-2">
          <Button variant="outline" className="w-full justify-start text-xs gap-2" onClick={() => handleAction('Summarize Chat')}>
            <MessageSquareText className="h-4 w-4" /> Summarize Chat
          </Button>
          <Button variant="outline" className="w-full justify-start text-xs gap-2" onClick={() => handleAction('Extract Tasks')}>
            <ClipboardList className="h-4 w-4" /> Extract Tasks
          </Button>
          <Button variant="outline" className="w-full justify-start text-xs gap-2" onClick={() => handleAction('Show Decisions')}>
            <GitBranch className="h-4 w-4" /> Show Decisions
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
