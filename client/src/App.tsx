import { useState, useCallback } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import { AppSidebar } from "./components/app-sidebar";
import { CopilotPanel } from "./components/CopilotPanel";
import { MessageBubble } from "./components/MessageBubble";
import { MessageInput } from "./components/MessageInput";
import { EmptyState } from "./components/EmptyState";
import { ContactAvatar } from "./components/ContactAvatar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { SettingsDialog } from "./components/SettingsDialog";
import { ServiceUnavailableState } from "./components/ServiceUnavailableState";
import { WhatsAppNotLinkedState } from "./components/WhatsAppNotLinkedState";
import { MessageSquare, AlertCircle, Settings } from "lucide-react";
import { useCustomers, useMessages, useSendMessage, useServerStatus, useSettings } from "./lib/api";
import { useWebSocket } from "./hooks/useWebSocket";
import NotFound from "@/pages/not-found";

function ChatView() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const queryClientInstance = useQueryClient();

  const { data: customers = [], isLoading: customersLoading, error: customersError } = useCustomers();
  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useMessages(selectedCustomerId);
  const { data: serverStatus, isLoading: serverStatusLoading, error: serverStatusError, refetch: refetchStatus } = useServerStatus();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  
  const sendMessageMutation = useSendMessage();

  const isServiceConnected = serverStatus?.connected ?? serverStatus?.ready ?? false;
  const isServerReachable = !serverStatusError && serverStatus !== undefined;

  const getServerStatus = useCallback((): "connected" | "disconnected" | "connecting" => {
    if (!settings?.configured) return "disconnected";
    if (serverStatusLoading) return "connecting";
    if (isServerReachable) return "connected";
    return "disconnected";
  }, [settings, isServerReachable, serverStatusLoading]);

  const getServiceStatus = useCallback((): "connected" | "disconnected" | "connecting" => {
    if (!settings?.configured) return "disconnected";
    if (serverStatusLoading) return "connecting";
    if (isServiceConnected) return "connected";
    return "disconnected";
  }, [settings, isServiceConnected, serverStatusLoading]);

  const { status: wsStatus } = useWebSocket({
    apiKey: settings?.configured ? settings.apiKey || null : null,
    onMessage: useCallback((msg: { type: string; data?: unknown }) => {
      console.log("WebSocket message received:", msg.type);
    }, []),
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  
  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  if (!settings?.configured) {
    return <WelcomeScreen />;
  }

  const isServerUnreachable = settings?.configured && !serverStatusLoading && serverStatusError;
  const isWhatsAppNotLinked = settings?.configured && !serverStatusLoading && !serverStatusError && serverStatus && !isServiceConnected;

  const handleSendMessage = async (message: string) => {
    if (!selectedCustomerId) return;
    
    try {
      await sendMessageMutation.mutateAsync({ customerId: selectedCustomerId, message });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const serverConnectionStatus = getServerStatus();
  const serviceConnectionStatus = getServiceStatus();

  return (
    <>
      <AppSidebar
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={setSelectedCustomerId}
        serverStatus={serverConnectionStatus}
        serviceStatus={serviceConnectionStatus}
        onSettingsClick={() => setSettingsOpen(true)}
        isLoading={customersLoading}
        error={isWhatsAppNotLinked ? null : customersError as Error | null}
        isWhatsAppNotLinked={isWhatsAppNotLinked}
      />
      
      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-3 border-b bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {selectedCustomer ? (
                <>
                  <ContactAvatar name={selectedCustomer.name} size="sm" />
                  <div>
                    <h2 className="font-medium text-sm">{selectedCustomer.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {serviceConnectionStatus === "connected" ? "Online" : "Offline"}
                    </p>
                  </div>
                </>
              ) : (
                <h2 className="font-medium">Select a chat</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                data-testid="button-header-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          
          <div className="flex-1 overflow-hidden">
            {isServerUnreachable ? (
              <ServiceUnavailableState
                message={(serverStatusError as Error)?.message || "Unable to reach the WhatsApp server. Please check your server URL and API key."}
                onRetry={() => refetchStatus()}
                onSettings={() => setSettingsOpen(true)}
                isRetrying={serverStatusLoading}
              />
            ) : isWhatsAppNotLinked ? (
              <WhatsAppNotLinkedState
                message={serverStatus?.message || serverStatus?.status || "The WhatsApp server is not connected to WhatsApp"}
                onRetry={() => refetchStatus()}
                onSettings={() => setSettingsOpen(true)}
                isRetrying={serverStatusLoading}
              />
            ) : selectedCustomer ? (
              messagesLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[70%] space-y-2">
                        <Skeleton className="h-16 w-48 rounded-lg" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messagesError ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                  <p className="text-sm font-medium text-destructive">Failed to load messages</p>
                  <p className="text-xs text-muted-foreground text-center">{(messagesError as Error).message}</p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          id={message.id}
                          body={message.body}
                          timestamp={message.timestamp}
                          isFromMe={message.isFromMe ?? false}
                          senderName={message.fromName}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              )
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No chat selected"
                description="Select a conversation from the sidebar to start messaging"
                className="h-full"
              />
            )}
          </div>
          
          {selectedCustomer && (
            <MessageInput
              onSend={handleSendMessage}
              isLoading={sendMessageMutation.isPending}
              disabled={!selectedCustomer || connectionStatus !== "connected"}
            />
          )}
        </div>
        
        <CopilotPanel
          selectedCustomerId={selectedCustomerId}
          messages={messages}
        />
      </main>
      
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <Router />
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
