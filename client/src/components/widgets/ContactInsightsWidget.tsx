import { Lightbulb, CheckCircle2, AlertCircle } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { useInsights, useGenerateInsights } from "@/lib/api";
import type { Message, ContactInsight } from "@shared/schema";

interface ContactInsightsWidgetProps {
  customerId: string | null;
  messages: Message[];
}

export function ContactInsightsWidget({ customerId, messages }: ContactInsightsWidgetProps) {
  const { data: insight, isLoading, refetch } = useInsights(customerId);
  const generateInsights = useGenerateInsights();

  const handleRefresh = async () => {
    if (!customerId || messages.length === 0) return;
    
    try {
      await generateInsights.mutateAsync({ customerId, messages });
    } catch (error) {
      console.error("Failed to refresh insights:", error);
    }
  };

  const typedInsight = insight as ContactInsight | undefined;

  if (!customerId) {
    return (
      <WidgetCard title="Contact Insights" icon={Lightbulb}>
        <p className="text-sm text-muted-foreground text-center py-4">
          Select a contact to see insights
        </p>
      </WidgetCard>
    );
  }

  const hasActionItems = typedInsight?.actionItems && typedInsight.actionItems.length > 0;

  return (
    <WidgetCard
      title="Contact Insights"
      icon={Lightbulb}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      isRefreshing={generateInsights.isPending}
      collapsible
    >
      {typedInsight ? (
        <div className="space-y-4">
          {hasActionItems && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Action Items
              </p>
              <ul className="space-y-1">
                {typedInsight.actionItems?.map((item, index) => (
                  <li 
                    key={index} 
                    className="text-sm flex items-start gap-2"
                    data-testid={`text-action-item-${index}`}
                  >
                    <span className="text-primary mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {!hasActionItems && (
            <div className="text-center py-2">
              <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No action items identified
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No insights available yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generate a conversation summary to get insights
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
