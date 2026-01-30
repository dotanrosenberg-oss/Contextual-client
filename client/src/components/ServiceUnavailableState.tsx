import { ServerOff, RefreshCw, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceUnavailableStateProps {
  message?: string;
  onRetry?: () => void;
  onSettings?: () => void;
  isRetrying?: boolean;
}

export function ServiceUnavailableState({
  message = "Unable to reach the WhatsApp server. Please check your server URL and API key.",
  onRetry,
  onSettings,
  isRetrying = false,
}: ServiceUnavailableStateProps) {
  return (
    <div className="flex items-center justify-center h-full w-full p-4">
      <Card className="w-full max-w-md" data-testid="card-service-unavailable">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10">
              <ServerOff className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle>Connection Failed</CardTitle>
          <CardDescription className="text-base">{message}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <Button
            variant="default"
            className="w-full"
            onClick={onRetry}
            disabled={isRetrying}
            data-testid="button-retry"
          >
            {isRetrying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Retry Connection
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={onSettings}
            data-testid="button-open-settings"
          >
            <Settings className="h-4 w-4" />
            Check Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
