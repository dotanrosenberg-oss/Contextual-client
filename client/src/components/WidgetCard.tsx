import { useState } from "react";
import { LucideIcon, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  isLoading?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function WidgetCard({
  title,
  icon: Icon,
  children,
  isLoading = false,
  collapsible = false,
  defaultCollapsed = false,
  onRefresh,
  isRefreshing = false,
  className,
}: WidgetCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <Card className={cn("overflow-visible", className)} data-testid={`widget-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 space-y-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing || isLoading}
              data-testid={`button-refresh-${title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isRefreshing && "animate-spin"
                )}
              />
              <span className="sr-only">Refresh</span>
            </Button>
          )}
          {collapsible && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              data-testid={`button-collapse-${title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              <span className="sr-only">{isCollapsed ? "Expand" : "Collapse"}</span>
            </Button>
          )}
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className="p-3 pt-0">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            children
          )}
        </CardContent>
      )}
    </Card>
  );
}
