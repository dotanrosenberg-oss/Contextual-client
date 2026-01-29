import { Link2 } from "lucide-react";
import { SiInstagram, SiFacebook, SiLinkedin } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WidgetCard } from "@/components/WidgetCard";

interface SocialIntegrationWidgetProps {
  customerId: string | null;
}

const socialPlatforms = [
  {
    id: "instagram",
    name: "Instagram",
    icon: SiInstagram,
    color: "text-pink-500",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: SiFacebook,
    color: "text-blue-600",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: SiLinkedin,
    color: "text-blue-500",
  },
];

export function SocialIntegrationWidget({ customerId }: SocialIntegrationWidgetProps) {
  if (!customerId) {
    return (
      <WidgetCard title="Social Profiles" icon={Link2} collapsible defaultCollapsed>
        <p className="text-sm text-muted-foreground text-center py-4">
          Select a contact to see social profiles
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Social Profiles" icon={Link2} collapsible>
      <div className="space-y-3">
        {socialPlatforms.map((platform) => (
          <div
            key={platform.id}
            className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
            data-testid={`social-platform-${platform.id}`}
          >
            <div className="flex items-center gap-2">
              <platform.icon className={`h-4 w-4 ${platform.color}`} />
              <span className="text-sm font-medium">{platform.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Coming Soon
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled
                data-testid={`button-connect-${platform.id}`}
              >
                Connect
              </Button>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
