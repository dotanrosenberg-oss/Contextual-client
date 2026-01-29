import { ContactAvatar } from "./ContactAvatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CustomerListItemProps {
  id: string;
  name: string;
  avatarUrl?: string | null;
  lastMessage?: string | null;
  lastMessageTime?: Date | null;
  unreadCount?: number;
  isSelected?: boolean;
  onClick?: () => void;
}

function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return "";
  
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CustomerListItem({
  id,
  name,
  avatarUrl,
  lastMessage,
  lastMessageTime,
  unreadCount = 0,
  isSelected = false,
  onClick,
}: CustomerListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-md text-left transition-colors",
        "hover-elevate",
        isSelected && "bg-sidebar-accent"
      )}
      data-testid={`customer-item-${id}`}
    >
      <ContactAvatar name={name} imageUrl={avatarUrl} size="md" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{name}</span>
          {lastMessageTime && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatRelativeTime(lastMessageTime)}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-sm text-muted-foreground truncate">
            {lastMessage || "No messages yet"}
          </p>
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="flex-shrink-0 h-5 min-w-5 flex items-center justify-center text-xs"
              data-testid={`unread-badge-${id}`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
