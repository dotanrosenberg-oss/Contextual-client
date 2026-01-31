import { useState } from "react";
import { useGroupParticipants, useFailedParticipants, useDeleteFailedParticipant } from "@/lib/api";
import { ContactAvatar } from "./ContactAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { AlertCircle, RefreshCw, Search, Phone, Users, X } from "lucide-react";
import type { Participant, FailedParticipant } from "@shared/schema";

interface ParticipantListProps {
  groupId: string;
  includePhotos?: boolean;
}

function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  if (phone.length > 10) {
    return `+${phone.slice(0, phone.length - 10)} ${phone.slice(-10, -7)} ${phone.slice(-7, -4)} ${phone.slice(-4)}`;
  }
  return phone;
}

function ParticipantItem({ participant }: { participant: Participant }) {
  const displayName = participant.name || formatPhoneNumber(participant.phone);
  
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-md"
      data-testid={`participant-item-${participant.id}`}
    >
      <ContactAvatar
        name={displayName}
        imageUrl={participant.profilePicUrl}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{displayName}</span>
          {participant.isSuperAdmin && (
            <Badge variant="default" className="text-xs">Creator</Badge>
          )}
          {participant.isAdmin && !participant.isSuperAdmin && (
            <Badge variant="secondary" className="text-xs">Admin</Badge>
          )}
        </div>
        {participant.phone && (
          <div
            className="flex items-center gap-1 text-xs text-muted-foreground"
            data-testid={`participant-phone-${participant.id}`}
          >
            <Phone className="h-3 w-3" />
            <span>{formatPhoneNumber(participant.phone)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface FailedParticipantItemProps {
  failed: FailedParticipant;
  onRemove: (id: number) => void;
  isRemoving: boolean;
}

function FailedParticipantItem({ failed, onRemove, isRemoving }: FailedParticipantItemProps) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-md opacity-60"
      data-testid={`failed-participant-item-${failed.id}`}
    >
      <ContactAvatar
        name={failed.phoneNumber}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate line-through">{formatPhoneNumber(failed.phoneNumber)}</span>
          <Badge variant="outline" className="text-xs text-destructive border-destructive">Failed</Badge>
        </div>
        <div className="text-xs text-destructive mt-0.5">
          {failed.reason}
        </div>
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
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ParticipantList({ groupId, includePhotos = false }: ParticipantListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: participants = [], isLoading, error, refetch, isRefetching } = useGroupParticipants(groupId, includePhotos);
  const { data: failedParticipants = [] } = useFailedParticipants(groupId);
  const deleteFailedParticipantMutation = useDeleteFailedParticipant();

  const handleRemoveFailedParticipant = (id: number) => {
    deleteFailedParticipantMutation.mutate({ id, customerId: groupId });
  };

  const filteredParticipants = participants.filter((p) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(searchLower) ||
      p.phone?.includes(searchQuery)
    );
  });

  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    if (a.isSuperAdmin && !b.isSuperAdmin) return -1;
    if (!a.isSuperAdmin && b.isSuperAdmin) return 1;
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    const errorMessage = (error as Error).message || "Failed to load participants";
    const isNotConnected = errorMessage.includes("503") || errorMessage.includes("not connected");
    
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-4" data-testid="participants-error">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <p className="font-medium text-destructive">Failed to load participants</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isNotConnected
              ? "Server is not connected to WhatsApp"
              : errorMessage}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefetching}
          data-testid="button-retry-participants"
        >
          {isRefetching ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Retry
        </Button>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-4" data-testid="participants-empty">
        <Users className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">No participants found</p>
          <p className="text-sm text-muted-foreground mt-1">
            This group doesn't have any participants yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Participants ({participants.length})</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isRefetching}
          data-testid="button-refresh-participants"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      
      {participants.length > 5 && (
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-participants"
            />
          </div>
        </div>
      )}
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {sortedParticipants.length === 0 && failedParticipants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mb-2" />
              <p className="text-sm">No participants match "{searchQuery}"</p>
            </div>
          ) : (
            <>
              {sortedParticipants.map((participant) => (
                <ParticipantItem key={participant.id} participant={participant} />
              ))}
              
              {failedParticipants.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 px-3 pb-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">
                      Failed to add ({failedParticipants.length})
                    </span>
                  </div>
                  {failedParticipants.map((failed) => (
                    <FailedParticipantItem
                      key={failed.id}
                      failed={failed}
                      onRemove={handleRemoveFailedParticipant}
                      isRemoving={deleteFailedParticipantMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
