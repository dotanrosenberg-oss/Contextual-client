import { useState } from "react";
import { MessageSquare, Settings, Server, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsDialog } from "./SettingsDialog";

export function WelcomeScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-background p-4">
      <Card className="w-full max-w-lg" data-testid="card-welcome">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Contextful</CardTitle>
          <CardDescription className="text-base">
            Your AI-powered WhatsApp communication assistant. Connect your WhatsApp server to get started.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              What you'll need
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Server className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">WhatsApp Server URL</p>
                  <p className="text-xs text-muted-foreground">
                    The address of your WhatsApp Web API server
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Key className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">API Key</p>
                  <p className="text-xs text-muted-foreground">
                    Your authentication key for the server
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={() => setSettingsOpen(true)}
            data-testid="button-setup"
          >
            <Settings className="h-4 w-4" />
            Configure Connection
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Your credentials are stored securely and never shared.
          </p>
        </CardContent>
      </Card>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
