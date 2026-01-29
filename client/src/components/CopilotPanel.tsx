import { useState } from "react";
import { Bot, PanelRightClose, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ConversationSummaryWidget } from "./widgets/ConversationSummaryWidget";
import { ContactInsightsWidget } from "./widgets/ContactInsightsWidget";
import { SharedGroupsWidget } from "./widgets/SharedGroupsWidget";
import { SocialIntegrationWidget } from "./widgets/SocialIntegrationWidget";
import type { Message } from "@shared/schema";

interface CopilotPanelProps {
  selectedCustomerId: string | null;
  messages: Message[];
  className?: string;
}

export function CopilotPanel({ selectedCustomerId, messages, className }: CopilotPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center py-4 px-2 border-l bg-background",
          className
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          data-testid="button-expand-copilot"
        >
          <PanelRight className="h-4 w-4" />
          <span className="sr-only">Expand copilot panel</span>
        </Button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="text-xs text-muted-foreground [writing-mode:vertical-lr] rotate-180">
            Copilot
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col w-80 border-l bg-background",
        className
      )}
      data-testid="copilot-panel"
    >
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Copilot</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          data-testid="button-minimize-copilot"
        >
          <PanelRightClose className="h-4 w-4" />
          <span className="sr-only">Minimize copilot panel</span>
        </Button>
      </div>
      
      <Tabs defaultValue="insights" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-3">
          <TabsTrigger value="insights" data-testid="tab-insights">
            Insights
          </TabsTrigger>
          <TabsTrigger value="social" data-testid="tab-social">
            Social
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="insights" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              <ConversationSummaryWidget 
                customerId={selectedCustomerId} 
                messages={messages} 
              />
              <ContactInsightsWidget 
                customerId={selectedCustomerId} 
                messages={messages} 
              />
              <SharedGroupsWidget customerId={selectedCustomerId} />
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="social" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              <SocialIntegrationWidget customerId={selectedCustomerId} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
