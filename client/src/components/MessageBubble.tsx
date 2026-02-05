import { cn } from "@/lib/utils";
import { 
  FileText, 
  Play, 
  Music, 
  FileSpreadsheet, 
  FileArchive, 
  FileCode, 
  FileImage,
  File,
  Download,
  BarChart3,
  Circle
} from "lucide-react";

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
  pollQuestion?: string | null;
  pollOptions?: string[] | null;
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

function getFileIcon(mimetype: string | null | undefined, filename: string | null | undefined) {
  const mime = mimetype?.toLowerCase() || "";
  const name = filename?.toLowerCase() || "";
  const ext = name.split(".").pop() || "";

  if (mime.startsWith("image/")) return <FileImage className="h-5 w-5 flex-shrink-0" />;
  if (mime.startsWith("video/")) return <Play className="h-5 w-5 flex-shrink-0" />;
  if (mime.startsWith("audio/")) return <Music className="h-5 w-5 flex-shrink-0" />;
  
  if (mime.includes("spreadsheet") || mime.includes("excel") || 
      ["csv", "xls", "xlsx", "numbers"].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 flex-shrink-0" />;
  }
  
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("archive") ||
      ["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <FileArchive className="h-5 w-5 flex-shrink-0" />;
  }
  
  if (mime.includes("javascript") || mime.includes("json") || mime.includes("xml") ||
      mime.includes("html") || mime.includes("css") ||
      ["js", "ts", "jsx", "tsx", "json", "xml", "html", "css", "py", "java", "cpp", "c", "h", "swift", "go", "rs", "rb", "php"].includes(ext)) {
    return <FileCode className="h-5 w-5 flex-shrink-0" />;
  }
  
  if (mime.includes("pdf") || mime.includes("document") || mime.includes("word") ||
      ["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext)) {
    return <FileText className="h-5 w-5 flex-shrink-0" />;
  }
  
  return <File className="h-5 w-5 flex-shrink-0" />;
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
        {getFileIcon(mimetype, filename)}
        <span className="text-sm truncate max-w-[180px]">
          {filename || "Download file"}
        </span>
        <Download className="h-4 w-4 flex-shrink-0 opacity-60" />
      </a>
    );
  }

  if (type === "image" || type === "video" || type === "audio" || type === "document") {
    const IconComponent = () => {
      if (type === "image") return <FileImage className="h-8 w-8" />;
      if (type === "video") return <Play className="h-8 w-8" />;
      if (type === "audio") return <Music className="h-8 w-8" />;
      return (
        <span className="h-8 w-8 flex items-center justify-center">
          {getFileIcon(mimetype, filename)}
        </span>
      );
    };

    return (
      <div
        className={cn(
          "flex items-center gap-2 p-3 rounded-md",
          isFromMe ? "bg-primary-foreground/10" : "bg-background"
        )}
      >
        <IconComponent />
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

function PollContent({
  question,
  options,
  isFromMe,
}: {
  question: string;
  options: string[];
  isFromMe: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md p-3",
        isFromMe ? "bg-primary-foreground/10" : "bg-background"
      )}
      data-testid="poll-content"
    >
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 flex-shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">Poll</span>
      </div>
      <p className="font-medium text-sm mb-3">{question}</p>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
              isFromMe ? "bg-primary-foreground/5" : "bg-muted"
            )}
            data-testid={`poll-option-${index}`}
          >
            <Circle className="h-3 w-3 flex-shrink-0 opacity-50" />
            <span>{option}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
  pollQuestion,
  pollOptions,
}: MessageBubbleProps) {
  const showMedia = hasMedia || (messageType && messageType !== "text" && messageType !== "chat" && messageType !== "poll");
  const isPoll = messageType === "poll" && pollQuestion && pollOptions && pollOptions.length > 0;

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
        
        {isPoll && (
          <div className="mb-2">
            <PollContent
              question={pollQuestion}
              options={pollOptions}
              isFromMe={isFromMe}
            />
          </div>
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
        
        {body && !isPoll && (
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
