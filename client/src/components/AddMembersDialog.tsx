import { useState } from "react";
import { Plus, X, Loader2, AlertCircle, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAddMembers, useSaveFailedParticipants } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AddMembersDialogProps {
  groupId: string;
  groupName: string;
  disabled?: boolean;
}

interface FailedParticipant {
  number: string;
  reason: string;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function AddMembersDialog({ groupId, groupName, disabled = false }: AddMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [failedParticipants, setFailedParticipants] = useState<FailedParticipant[]>([]);
  const [phoneInput, setPhoneInput] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const { toast } = useToast();

  const addMembersMutation = useAddMembers();
  const saveFailedParticipantsMutation = useSaveFailedParticipants();

  const isLoading = addMembersMutation.isPending;

  const handleAddParticipant = () => {
    const cleaned = phoneInput.replace(/\D/g, "");
    if (cleaned.length >= 10 && !participants.includes(cleaned)) {
      setParticipants([...participants, cleaned]);
      setPhoneInput("");
    }
  };

  const handleRemoveParticipant = (phone: string) => {
    setParticipants(participants.filter((p) => p !== phone));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddParticipant();
    }
  };

  const handleSubmit = async () => {
    if (participants.length === 0) return;

    try {
      const result = await addMembersMutation.mutateAsync({
        groupId,
        participants,
      });

      const added = result.summary?.successfullyAdded || 0;
      const failedNumbers = result.results?.failed || [];

      setSuccessCount(added);

      if (failedNumbers.length > 0) {
        setFailedParticipants(
          failedNumbers.map((f) => ({
            number: f.number,
            reason: f.reason || "Unknown reason",
          }))
        );

        const failedNumberSet = new Set(failedNumbers.map((f) => f.number));
        setParticipants((prev) => prev.filter((p) => failedNumberSet.has(p)));

        await saveFailedParticipantsMutation.mutateAsync({
          customerId: groupId,
          participants: failedNumbers.map((f) => ({
            phoneNumber: f.number,
            reason: f.reason || "Unknown reason",
          })),
        });

        setShowResults(true);
      } else {
        toast({
          title: "Members added",
          description: `Successfully added ${added} member${added !== 1 ? "s" : ""} to "${groupName}"`,
        });
        handleClose();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add members",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
    setParticipants([]);
    setFailedParticipants([]);
    setPhoneInput("");
    setShowResults(false);
    setSuccessCount(0);
    addMembersMutation.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          data-testid="button-add-members"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-add-members">
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
          <DialogDescription>
            Add new members to "{groupName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {showResults ? (
            <div className="space-y-4">
              {successCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Successfully added {successCount} member{successCount !== 1 ? "s" : ""}.
                </p>
              )}
              {failedParticipants.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">
                      {failedParticipants.length} member{failedParticipants.length !== 1 ? "s" : ""} couldn't be added:
                    </p>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {failedParticipants.map((failed) => (
                        <div
                          key={failed.number}
                          className="flex items-center justify-between p-2 rounded-md bg-destructive/10"
                          data-testid={`failed-member-${failed.number}`}
                        >
                          <span className="text-sm font-mono">{formatPhoneNumber(failed.number)}</span>
                          <span className="text-xs text-muted-foreground">{failed.reason}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    These failures have been saved. You can request invite URLs from the "Failed" button in the participant list.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="Enter phone number"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  data-testid="input-phone-number"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddParticipant}
                  disabled={phoneInput.replace(/\D/g, "").length < 10}
                  data-testid="button-add-phone"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {participants.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                  <div className="flex flex-wrap gap-2">
                    {participants.map((phone) => (
                      <Badge
                        key={phone}
                        variant="secondary"
                        className="gap-1 pr-1"
                        data-testid={`badge-participant-${phone}`}
                      >
                        {formatPhoneNumber(phone)}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => handleRemoveParticipant(phone)}
                          data-testid={`button-remove-${phone}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {participants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add phone numbers above to add members to the group
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {showResults ? (
            <Button onClick={handleClose} data-testid="button-done">
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={participants.length === 0 || isLoading}
                data-testid="button-submit-members"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  `Add ${participants.length} Member${participants.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
