import React from 'react';
import { format } from 'date-fns';
import { Paperclip, ClipboardList, Copy, Reply, ExternalLink, FileText, Image as ImageIcon, Mic } from 'lucide-react';

interface ChatMessageBubbleProps {
  msg: any;
  isMe: boolean;
  onConvertToTask: (msg: any) => void;
  onReply: (msg: any) => void;
  replyToContent?: string;
}

export function ChatMessageBubble({ msg, isMe, onConvertToTask, onReply, replyToContent }: ChatMessageBubbleProps) {
  const isImage = msg.attachment_url && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(msg.attachment_url);
  const isPdf = msg.attachment_url && /\.pdf(\?|$)/i.test(msg.attachment_url);

  const copyText = () => {
    if (msg.content) navigator.clipboard.writeText(msg.content);
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Reply context */}
        {replyToContent && (
          <div className={`text-[10px] px-2.5 py-1 rounded-lg border-l-2 border-primary/40 bg-muted/50 text-muted-foreground mb-0.5 truncate max-w-[200px]`}>
            {replyToContent}
          </div>
        )}
        <div className={`rounded-2xl px-3.5 py-2 ${
          isMe
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted border border-border rounded-bl-md'
        }`}>
          {!isMe && <p className="text-[10px] font-bold opacity-70 mb-0.5">{msg.senderName}</p>}
          {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}

          {/* Attachment preview */}
          {msg.attachment_url && (
            <div className="mt-1.5">
              {isImage ? (
                <a href={msg.attachment_url} target="_blank" rel="noopener">
                  <img src={msg.attachment_url} alt="attachment" className="rounded-lg max-h-48 max-w-full object-cover" />
                </a>
              ) : (
                <a href={msg.attachment_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-[11px] underline">
                  {isPdf ? <FileText className="h-3.5 w-3.5 shrink-0" /> : <Paperclip className="h-3.5 w-3.5 shrink-0" />}
                  Attachment
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
            </div>
          )}

          <p className={`text-[9px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
            {format(new Date(msg.created_at), 'h:mm a')}
          </p>
        </div>

        {/* Hover actions */}
        <div className={`flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'justify-end' : 'justify-start'}`}>
          <button onClick={() => onReply(msg)} className="p-1 rounded hover:bg-muted" title="Reply">
            <Reply className="h-3 w-3 text-muted-foreground" />
          </button>
          <button onClick={() => onConvertToTask(msg)} className="p-1 rounded hover:bg-muted" title="Convert to task">
            <ClipboardList className="h-3 w-3 text-muted-foreground" />
          </button>
          <button onClick={copyText} className="p-1 rounded hover:bg-muted" title="Copy">
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
