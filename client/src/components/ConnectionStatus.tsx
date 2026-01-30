import { cn } from "@/lib/utils";
import { Server, Smartphone } from "lucide-react";

type ConnectionState = "connected" | "disconnected" | "connecting";

interface ConnectionStatusProps {
  serverStatus: ConnectionState;
  serviceStatus: ConnectionState;
  showLabels?: boolean;
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

function StatusIndicator({ status, label }: { status: ConnectionState; label: string }) {
  const config = statusConfig[status];
  
  return (
    <div className="flex items-center gap-1.5" data-testid={`status-${label.toLowerCase()}-${status}`}>
      <span className="relative flex h-2 w-2">
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
            "relative inline-flex h-2 w-2 rounded-full",
            config.color
          )}
        />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ConnectionStatus({
  serverStatus,
  serviceStatus,
  showLabels = true,
  className,
}: ConnectionStatusProps) {
  return (
    <div
      className={cn("flex items-center gap-4", className)}
      data-testid="connection-status"
    >
      <div className="flex items-center gap-1.5">
        <Server className="h-3.5 w-3.5 text-muted-foreground" />
        <StatusIndicator status={serverStatus} label="Server" />
      </div>
      <div className="flex items-center gap-1.5">
        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
        <StatusIndicator status={serviceStatus} label="WhatsApp" />
      </div>
    </div>
  );
}
