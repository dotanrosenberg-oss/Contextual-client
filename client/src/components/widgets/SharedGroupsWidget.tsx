import { Users } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";

interface SharedGroupsWidgetProps {
  customerId: string | null;
}

export function SharedGroupsWidget({ customerId }: SharedGroupsWidgetProps) {
  if (!customerId) {
    return (
      <WidgetCard title="Shared Groups" icon={Users} collapsible defaultCollapsed>
        <p className="text-sm text-muted-foreground text-center py-4">
          Select a contact to see shared groups
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Shared Groups" icon={Users} collapsible defaultCollapsed>
      <div className="text-center py-4">
        <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Shared groups will appear here
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Groups you and this contact are both members of
        </p>
      </div>
    </WidgetCard>
  );
}
