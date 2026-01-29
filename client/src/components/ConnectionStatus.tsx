import { cn } from "@/lib/utils";

type ConnectionState = "connected" | "disconnected" | "connecting";

interface ConnectionStatusProps {
  status: ConnectionState;
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  connected: {
    color: "bg-green-500",
    pulse: true,
    label: "Connected",
  },
  disconnected: {
    color: "bg-red-500",
    pulse: false,
    label: "Disconnected",
  },
  connecting: {
    color: "bg-amber-500",
    pulse: true,
    label: "Connecting...",
  },
};

export function ConnectionStatus({
  status,
  showLabel = true,
  className,
}: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-testid={`connection-status-${status}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.color
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            config.color
          )}
        />
      </span>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{config.label}</span>
      )}
    </div>
  );
}
