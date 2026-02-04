import { cn } from "@/lib/utils";
import { FileText, Play, Music } from "lucide-react";

interface MessageBubbleProps {
  id: string;
  body: string;
  timestamp: Date;
  isFromMe?: boolean;
  senderName?: string | null;
  hasMedia?: boolean;
  messageType?: string | null;
  mediaUrl?: string | null;
  mimetype?: string | null;
  filename?: string | null;
}

function formatMessageTime(date: Date): string {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMediaTypeFromMimetype(mimetype: string | null | undefined): "image" | "video" | "audio" | "document" | null {
  if (!mimetype) return null;
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
}

function MediaContent({
  messageType,
  mediaUrl,
  mimetype,
  filename,
  isFromMe,
}: {
  messageType?: string | null;
  mediaUrl?: string | null;
  mimetype?: string | null;
  filename?: string | null;
  isFromMe: boolean;
}) {
  const type = messageType || getMediaTypeFromMimetype(mimetype);
  
  if (!type || type === "text" || type === "chat") {
    return null;
  }

  if (type === "image" && mediaUrl) {
    return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={mediaUrl}
          alt={filename || "Image"}
          className="max-w-full rounded-md max-h-64 object-contain"
          loading="lazy"
        />
      </a>
    );
  }

  if (type === "video" && mediaUrl) {
    return (
      <video
        src={mediaUrl}
        controls
        className="max-w-full rounded-md max-h-64"
        preload="metadata"
      />
    );
  }

  if (type === "audio" && mediaUrl) {
    return (
      <audio src={mediaUrl} controls className="max-w-full" preload="metadata" />
    );
  }

  if ((type === "document" || type === "ptt" || type === "sticker") && mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-2 p-2 rounded-md",
          isFromMe ? "bg-primary-foreground/10" : "bg-background"
        )}
        data-testid={`link-download-${filename || "file"}`}
      >
        <FileText className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm truncate max-w-[180px]">
          {filename || "Download file"}
        </span>
      </a>
    );
  }

  if (type === "image" || type === "video" || type === "audio" || type === "document") {
    const icons = {
      image: <FileText className="h-8 w-8" />,
      video: <Play className="h-8 w-8" />,
      audio: <Music className="h-8 w-8" />,
      document: <FileText className="h-8 w-8" />,
    };

    return (
      <div
        className={cn(
          "flex items-center gap-2 p-3 rounded-md",
          isFromMe ? "bg-primary-foreground/10" : "bg-background"
        )}
      >
        {icons[type as keyof typeof icons] || <FileText className="h-8 w-8" />}
        <div className="flex flex-col">
          <span className="text-sm font-medium capitalize">{type}</span>
          {filename && (
            <span className="text-xs opacity-70 truncate max-w-[150px]">
              {filename}
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function MessageBubble({
  id,
  body,
  timestamp,
  isFromMe = false,
  senderName,
  hasMedia,
  messageType,
  mediaUrl,
  mimetype,
  filename,
}: MessageBubbleProps) {
  const showMedia = hasMedia || (messageType && messageType !== "text" && messageType !== "chat");

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
        
        {showMedia && (
          <div className="mb-2">
            <MediaContent
              messageType={messageType}
              mediaUrl={mediaUrl}
              mimetype={mimetype}
              filename={filename}
              isFromMe={isFromMe}
            />
          </div>
        )}
        
        {body && (
          <p className="text-sm whitespace-pre-wrap break-words">{body}</p>
        )}
        
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
