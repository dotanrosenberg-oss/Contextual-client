import { useState } from "react";
import { MessageSquare, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WidgetCard } from "@/components/WidgetCard";
import { useInsights, useGenerateInsights } from "@/lib/api";
import type { Message, ContactInsight } from "@shared/schema";

interface ConversationSummaryWidgetProps {
  customerId: string | null;
  messages: Message[];
}

export function ConversationSummaryWidget({ customerId, messages }: ConversationSummaryWidgetProps) {
  const { data: insight, isLoading: isLoadingInsight } = useInsights(customerId);
  const generateInsights = useGenerateInsights();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSummary = async () => {
    if (!customerId || messages.length === 0) return;
    
    setIsGenerating(true);
    try {
      await generateInsights.mutateAsync({ customerId, messages });
    } catch (error) {
      console.error("Failed to generate insights:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const typedInsight = insight as ContactInsight | undefined;

  if (!customerId) {
    return (
      <WidgetCard title="Conversation Summary" icon={MessageSquare}>
        <p className="text-sm text-muted-foreground text-center py-4">
          Select a conversation to see AI summary
        </p>
      </WidgetCard>
    );
  }

  const isLoading = isLoadingInsight || isGenerating;

  return (
    <WidgetCard
      title="Conversation Summary"
      icon={MessageSquare}
      isLoading={isLoading && !typedInsight}
    >
      <div className="space-y-4">
        {typedInsight ? (
          <>
            <p className="text-sm" data-testid="text-summary">{typedInsight.summary}</p>
            
            {typedInsight.keyTopics && typedInsight.keyTopics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Key Topics</p>
                <div className="flex flex-wrap gap-1">
                  {typedInsight.keyTopics.map((topic, index) => (
                    <Badge key={index} variant="secondary" className="text-xs" data-testid={`badge-topic-${index}`}>
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {typedInsight.relationshipStrength && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">Relationship Strength</p>
                  <span className="text-xs font-medium">{typedInsight.relationshipStrength}/10</span>
                </div>
                <Progress 
                  value={typedInsight.relationshipStrength * 10} 
                  className="h-2"
                  data-testid="progress-relationship-strength"
                />
              </div>
            )}
            
            {typedInsight.generatedAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Updated {new Date(typedInsight.generatedAt).toLocaleDateString()}</span>
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSummary}
              disabled={isGenerating || messages.length === 0}
              className="w-full"
              data-testid="button-regenerate-summary"
            >
              <Sparkles className="h-3 w-3 mr-2" />
              {isGenerating ? "Generating..." : "Regenerate Summary"}
            </Button>
          </>
        ) : (
          <div className="space-y-3 text-center py-2">
            <p className="text-sm text-muted-foreground">
              {messages.length === 0 
                ? "No messages to analyze" 
                : "Generate an AI-powered summary of this conversation"}
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateSummary}
              disabled={isGenerating || messages.length === 0}
              data-testid="button-generate-summary"
            >
              <Sparkles className="h-3 w-3 mr-2" />
              {isGenerating ? "Generating..." : "Generate Summary"}
            </Button>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
