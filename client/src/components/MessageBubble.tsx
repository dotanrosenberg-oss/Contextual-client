import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  id: string;
  body: string;
  timestamp: Date;
  isFromMe?: boolean;
  senderName?: string | null;
}

function formatMessageTime(date: Date): string {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  id,
  body,
  timestamp,
  isFromMe = false,
  senderName,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex w-full",
        isFromMe ? "justify-end" : "justify-start"
      )}
      data-testid={`message-bubble-${id}`}
    >
      <div
        className={cn(
          "max-w-[70%] px-3 py-2 rounded-lg",
          isFromMe
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-muted rounded-bl-none"
        )}
      >
        {!isFromMe && senderName && (
          <p className="text-xs font-medium text-primary mb-1">{senderName}</p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{body}</p>
        <p
          className={cn(
            "text-xs mt-1",
            isFromMe ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatMessageTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
