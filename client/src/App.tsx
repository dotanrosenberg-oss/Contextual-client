import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import { AppSidebar } from "./components/app-sidebar";
import { CopilotPanel } from "./components/CopilotPanel";
import { MessageBubble } from "./components/MessageBubble";
import { MessageInput } from "./components/MessageInput";
import { EmptyState } from "./components/EmptyState";
import { WidgetCard } from "./components/WidgetCard";
import { ContactAvatar } from "./components/ContactAvatar";
import { MessageSquare, User, Lightbulb, Calendar } from "lucide-react";
import NotFound from "@/pages/not-found";
import type { Customer, Message } from "@shared/schema";

const mockCustomers: Customer[] = [
  {
    id: "1",
    name: "John Smith",
    description: null,
    participantCount: null,
    lastMessage: "Hey, how are you doing?",
    lastMessageTime: new Date(Date.now() - 5 * 60000),
    unreadCount: 2,
    isAdmin: false,
    avatarUrl: null,
    createdAt: new Date(),
  },
  {
    id: "2",
    name: "Sarah Johnson",
    description: null,
    participantCount: null,
    lastMessage: "Thanks for the update!",
    lastMessageTime: new Date(Date.now() - 2 * 3600000),
    unreadCount: 0,
    isAdmin: false,
    avatarUrl: null,
    createdAt: new Date(),
  },
  {
    id: "3",
    name: "Tech Support Group",
    description: "Technical support team",
    participantCount: 5,
    lastMessage: "Issue has been resolved",
    lastMessageTime: new Date(Date.now() - 24 * 3600000),
    unreadCount: 0,
    isAdmin: true,
    avatarUrl: null,
    createdAt: new Date(),
  },
];

const mockMessages: Message[] = [
  {
    id: "m1",
    customerId: "1",
    body: "Hey, how are you doing?",
    fromPhone: "+1234567890",
    fromName: "John Smith",
    timestamp: new Date(Date.now() - 10 * 60000),
    isFromMe: false,
    hasMedia: false,
    messageType: "text",
  },
  {
    id: "m2",
    customerId: "1",
    body: "I wanted to check in about the project",
    fromPhone: "+1234567890",
    fromName: "John Smith",
    timestamp: new Date(Date.now() - 8 * 60000),
    isFromMe: false,
    hasMedia: false,
    messageType: "text",
  },
  {
    id: "m3",
    customerId: "1",
    body: "Hi John! I'm doing great. The project is coming along well.",
    fromPhone: null,
    fromName: null,
    timestamp: new Date(Date.now() - 5 * 60000),
    isFromMe: true,
    hasMedia: false,
    messageType: "text",
  },
];

function ChatView() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>("1");
  const [isSending, setIsSending] = useState(false);

  const selectedCustomer = mockCustomers.find(c => c.id === selectedCustomerId);
  const customerMessages = mockMessages.filter(m => m.customerId === selectedCustomerId);

  const handleSendMessage = async (message: string) => {
    setIsSending(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("Sending message:", message);
    setIsSending(false);
  };

  return (
    <>
      <AppSidebar
        customers={mockCustomers}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={setSelectedCustomerId}
        connectionStatus="connected"
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
                    <p className="text-xs text-muted-foreground">Online</p>
                  </div>
                </>
              ) : (
                <h2 className="font-medium">Select a chat</h2>
              )}
            </div>
            <ThemeToggle />
          </header>
          
          <div className="flex-1 overflow-hidden">
            {selectedCustomer ? (
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  {customerMessages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      id={message.id}
                      body={message.body}
                      timestamp={message.timestamp}
                      isFromMe={message.isFromMe ?? false}
                      senderName={message.fromName}
                    />
                  ))}
                </div>
              </ScrollArea>
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
              isLoading={isSending}
              disabled={!selectedCustomer}
            />
          )}
        </div>
        
        <CopilotPanel>
          <WidgetCard
            title="Contact Info"
            icon={User}
            collapsible
          >
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {selectedCustomer?.name || "N/A"}</p>
              <p><span className="text-muted-foreground">Status:</span> Active customer</p>
            </div>
          </WidgetCard>
          
          <WidgetCard
            title="AI Insights"
            icon={Lightbulb}
            onRefresh={() => console.log("Refreshing insights")}
            collapsible
          >
            <p className="text-sm text-muted-foreground">
              Based on recent conversations, this customer is interested in product updates.
            </p>
          </WidgetCard>
          
          <WidgetCard
            title="Upcoming Tasks"
            icon={Calendar}
            collapsible
            defaultCollapsed
          >
            <p className="text-sm text-muted-foreground">No upcoming tasks</p>
          </WidgetCard>
        </CopilotPanel>
      </main>
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
