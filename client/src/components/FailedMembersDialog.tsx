import { useState } from "react";
import { useFailedParticipants, useDeleteFailedParticipant, useRequestJoinUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContactAvatar } from "./ContactAvatar";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Copy, Link, Loader2, X, Check } from "lucide-react";
import type { FailedParticipant } from "@shared/schema";

interface FailedMembersDialogProps {
  groupId: string;
}

function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  if (phone.length > 10) {
    return `+${phone.slice(0, phone.length - 10)} ${phone.slice(-10, -7)} ${phone.slice(-7, -4)} ${phone.slice(-4)}`;
  }
  return phone;
}

function FailedMemberItem({
  failed,
  groupId,
  onRemove,
  isRemoving,
}: {
  failed: FailedParticipant;
  groupId: string;
  onRemove: (id: number) => void;
  isRemoving: boolean;
}) {
  const { toast } = useToast();
  const requestJoinUrlMutation = useRequestJoinUrl();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleRequestUrl = () => {
    requestJoinUrlMutation.mutate(
      {
        groupId,
        phoneNumber: failed.phoneNumber,
        failedParticipantId: failed.id,
      },
      {
        onSuccess: (data) => {
          toast({
            title: "Invite link generated",
            description: "You can now copy and share the link with this contact.",
          });
        },
        onError: (error) => {
          toast({
            title: "Failed to generate invite link",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleCopyUrl = async () => {
    if (!failed.joinUrl) return;
    
    try {
      await navigator.clipboard.writeText(failed.joinUrl);
      setCopiedId(failed.id);
      toast({
        title: "Link copied",
        description: "The invite link has been copied to your clipboard.",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy the link to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-md border bg-card"
      data-testid={`failed-member-item-${failed.id}`}
    >
      <div className="flex items-center gap-3">
        <ContactAvatar name={failed.phoneNumber} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {formatPhoneNumber(failed.phoneNumber)}
            </span>
          </div>
          <div className="text-xs text-destructive mt-0.5">{failed.reason}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(failed.id)}
          disabled={isRemoving}
          data-testid={`button-remove-failed-${failed.id}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 mt-1">
        {failed.joinUrl ? (
          <>
            <div className="flex-1 text-xs text-muted-foreground truncate bg-muted px-2 py-1 rounded">
              {failed.joinUrl}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              data-testid={`button-copy-url-${failed.id}`}
            >
              {copiedId === failed.id ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <Copy className="h-4 w-4 mr-1" />
              )}
              {copiedId === failed.id ? "Copied" : "Copy"}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestUrl}
            disabled={requestJoinUrlMutation.isPending}
            data-testid={`button-get-url-${failed.id}`}
          >
            {requestJoinUrlMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Link className="h-4 w-4 mr-1" />
            )}
            Get Invite Link
          </Button>
        )}
      </div>
    </div>
  );
}

export function FailedMembersDialog({ groupId }: FailedMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: failedParticipants = [], isLoading } = useFailedParticipants(groupId);
  const deleteFailedParticipantMutation = useDeleteFailedParticipant();

  const handleRemove = (id: number) => {
    deleteFailedParticipantMutation.mutate({ id, customerId: groupId });
  };

  const failedCount = failedParticipants.length;

  if (failedCount === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="button-failed-members"
        >
          <AlertCircle className="h-4 w-4 text-destructive" />
          Failed
          <Badge variant="destructive" className="ml-1">
            {failedCount}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Failed to Add Members
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          These contacts couldn't be added to the group. You can generate invite
          links for them to join manually.
        </div>

        <ScrollArea className="max-h-80">
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading...
              </div>
            ) : (
              failedParticipants.map((failed) => (
                <FailedMemberItem
                  key={failed.id}
                  failed={failed}
                  groupId={groupId}
                  onRemove={handleRemove}
                  isRemoving={deleteFailedParticipantMutation.isPending}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
