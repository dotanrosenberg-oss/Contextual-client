import { useState, useRef, useCallback, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Send, Loader2, Paperclip, X, File, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface Attachment {
  file: File;
  preview: string | null;
  type: "image" | "video" | "audio" | "document";
}

interface MessageInputProps {
  onSend: (message: string, attachment?: Attachment) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

function getAttachmentType(mimeType: string): Attachment["type"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}


const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

export function MessageInput({
  onSend,
  isLoading = false,
  placeholder = "Type a message...",
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
    };
  }, [attachment]);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if ((trimmed || attachment) && !isLoading) {
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      onSend(trimmed, attachment || undefined);
      setMessage("");
      setAttachment(null);
      setFileError(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [message, attachment, isLoading, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setMessage(textarea.value);
    
    textarea.style.height = "auto";
    const lineHeight = 24;
    const maxRows = 4;
    const maxHeight = lineHeight * maxRows;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File too large. Maximum size is 16MB.");
      return;
    }

    const type = getAttachmentType(file.type);
    let preview: string | null = null;

    if (type === "image") {
      preview = URL.createObjectURL(file);
    }

    setAttachment({ file, preview, type });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = () => {
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview);
    }
    setAttachment(null);
    setFileError(null);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const canSend = (message.trim() || attachment) && !isLoading && !disabled;

  return (
    <div className="border-t bg-background">
      {attachment && (
        <div className="p-3 pb-0">
          <div className="inline-flex items-center gap-2 bg-muted rounded-md p-2 pr-3">
            {attachment.type === "image" && attachment.preview ? (
              <img 
                src={attachment.preview} 
                alt="Attachment preview" 
                className="h-12 w-12 object-cover rounded"
              />
            ) : (
              <div className="h-12 w-12 flex items-center justify-center bg-background rounded">
                {attachment.type === "image" ? (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <File className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate max-w-[200px]">
                {attachment.file.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {(attachment.file.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveAttachment}
              data-testid="button-remove-attachment"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {fileError && (
        <div className="px-3 pt-2">
          <p className="text-sm text-destructive">{fileError}</p>
        </div>
      )}
      
      <div className="flex items-end gap-2 p-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file-attachment"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleAttachClick}
          disabled={disabled || isLoading}
          data-testid="button-attach-file"
        >
          <Paperclip className="h-5 w-5" />
          <span className="sr-only">Attach file</span>
        </Button>
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="flex-1 resize-none"
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          data-testid="button-send-message"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send message</span>
        </Button>
      </div>
    </div>
  );
}
