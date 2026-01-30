import { Smartphone, RefreshCw, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WhatsAppNotLinkedStateProps {
  message?: string;
  onRetry?: () => void;
  onSettings?: () => void;
  isRetrying?: boolean;
}

export function WhatsAppNotLinkedState({
  message = "The WhatsApp server is not connected to WhatsApp",
  onRetry,
  onSettings,
  isRetrying = false,
}: WhatsAppNotLinkedStateProps) {
  return (
    <div className="flex items-center justify-center h-full w-full p-4">
      <Card className="w-full max-w-md" data-testid="card-whatsapp-not-linked">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-amber-500/10">
              <Smartphone className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <CardTitle>WhatsApp Not Linked</CardTitle>
          <CardDescription className="text-base">
            {message}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            Your WhatsApp server is online but needs to be connected to WhatsApp. 
            Please scan the QR code on your WhatsApp server to link your account.
          </div>

          <div className="space-y-2">
            <Button
              variant="default"
              className="w-full"
              onClick={onRetry}
              disabled={isRetrying}
              data-testid="button-check-status"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Check Status
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
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
