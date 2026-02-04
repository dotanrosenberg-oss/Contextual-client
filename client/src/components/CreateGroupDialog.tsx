import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Upload, Users, Loader2, AlertCircle, Pencil, MessageSquare, UserPlus, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateGroup, useSaveFailedParticipants, CreateGroupValidationError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const createGroupFormSchema = z.object({
  name: z.string().min(1, "Group name is required"),
});

type CreateGroupFormValues = z.infer<typeof createGroupFormSchema>;

interface CreateGroupDialogProps {
  disabled?: boolean;
}

interface FailedParticipant {
  number: string;
  reason: string;
}

interface GroupSettings {
  membersCanEditGroupSettings: boolean;
  membersCanSendMessages: boolean;
  membersCanAddOthers: boolean;
}

const defaultGroupSettings: GroupSettings = {
  membersCanEditGroupSettings: true,
  membersCanSendMessages: true,
  membersCanAddOthers: true,
};

export function CreateGroupDialog({ disabled = false }: CreateGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [failedParticipants, setFailedParticipants] = useState<FailedParticipant[]>([]);
  const [phoneInput, setPhoneInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [createdGroupName, setCreatedGroupName] = useState<string | null>(null);
  const [groupSettings, setGroupSettings] = useState<GroupSettings>(defaultGroupSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const createGroupMutation = useCreateGroup();
  const saveFailedParticipantsMutation = useSaveFailedParticipants();
  
  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const handleAddParticipant = () => {
    const phone = phoneInput.trim();
    if (!phone) return;
    
    const normalizedPhone = phone.replace(/[^\d+]/g, "");
    if (normalizedPhone.length < 7) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }
    
    if (participants.includes(normalizedPhone)) {
      toast({
        title: "Duplicate number",
        description: "This number is already added",
        variant: "destructive",
      });
      return;
    }
    
    setParticipants([...participants, normalizedPhone]);
    setPhoneInput("");
  };

  const handleRemoveParticipant = (phone: string) => {
    setParticipants(participants.filter(p => p !== phone));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    
    // Store the actual file for upload
    setIconFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setIconFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (values: CreateGroupFormValues) => {
    if (participants.length === 0) {
      toast({
        title: "No participants",
        description: "Add at least one phone number to create a group",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const result = await createGroupMutation.mutateAsync({
        name: values.name,
        participants,
        iconFile: iconFile || undefined,
        settings: {
          membersCanEditSettings: groupSettings.membersCanEditGroupSettings,
          membersCanSendMessages: groupSettings.membersCanSendMessages,
          membersCanAddMembers: groupSettings.membersCanAddOthers,
        },
      });
      
      const successCount = result.summary?.successfullyAdded || 0;
      const failedNumbers = result.results?.failed || [];
      
      if (failedNumbers.length > 0) {
        // Keep dialog open to show failed participants
        setCreatedGroupName(result.groupName);
        setFailedParticipants(failedNumbers.map(f => ({
          number: f.number,
          reason: f.reason || "unknown reason"
        })));
        // Remove successful participants from the list
        const failedNumberSet = new Set(failedNumbers.map(f => f.number));
        setParticipants(prev => prev.filter(p => failedNumberSet.has(p)));
        
        // Save failed participants to database for display in participant list
        // Check for groupId or fallback to customer.id
        const groupIdentifier = result.groupId || result.customer?.id;
        console.log("Group creation result:", result, "Using groupId:", groupIdentifier);
        if (groupIdentifier) {
          const payload = {
            customerId: groupIdentifier,
            participants: failedNumbers.map(f => ({
              phoneNumber: f.number,
              reason: f.reason || "unknown reason",
            })),
          };
          console.log("Saving failed participants with payload:", payload);
          saveFailedParticipantsMutation.mutate(payload, {
            onSuccess: (data) => {
              console.log("Successfully saved failed participants:", data);
            },
            onError: (error) => {
              console.error("Error saving failed participants:", error);
            },
          });
        }
        
        toast({
          title: "Group created",
          description: `"${result.groupName}" created with ${successCount} member${successCount === 1 ? "" : "s"}. See failed numbers below.`,
        });
      } else {
        toast({
          title: "Group created",
          description: `"${result.groupName}" created with ${successCount} member${successCount === 1 ? "" : "s"}`,
        });
        
        setOpen(false);
        form.reset();
        setParticipants([]);
        setFailedParticipants([]);
        setCreatedGroupName(null);
        setImagePreview(null);
        setIconFile(null);
        setGroupSettings(defaultGroupSettings);
      }
    } catch (error) {
      if (error instanceof CreateGroupValidationError) {
        setFailedParticipants(error.failedParticipants.map(f => ({
          number: f.number,
          reason: f.reason || "Not registered on WhatsApp or doesn't allow group invites"
        })));
        toast({
          title: "Invalid phone numbers",
          description: "Some phone numbers couldn't be verified. Please check the numbers highlighted below.",
        });
      } else {
        toast({
          title: "Failed to create group",
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddParticipant();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="w-full"
          data-testid="button-create-group"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col" data-testid="dialog-create-group">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {createdGroupName ? (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Some members couldn't be added
              </>
            ) : (
              <>
                <Users className="h-5 w-5" />
                Create New Group
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {createdGroupName 
              ? "Review the failed participants below."
              : "Set up your group with members and configure permissions."}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 overflow-y-auto pr-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {createdGroupName && (
              <p className="text-sm text-muted-foreground">
                Group "{createdGroupName}" was created. The following numbers couldn't be added:
              </p>
            )}
            
            {!createdGroupName && (
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {imagePreview ? (
                    <AvatarImage src={imagePreview} alt="Group image" />
                  ) : (
                    <AvatarFallback className="bg-primary/10">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>
                {imagePreview && (
                  <button
                    type="button"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover-elevate"
                    onClick={handleRemoveImage}
                    data-testid="button-remove-image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  data-testid="input-group-image"
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter group name..."
                          {...field}
                          data-testid="input-group-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            )}

            <div className="space-y-2">
              {!createdGroupName && <FormLabel>Participants</FormLabel>}
              {!createdGroupName && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter phone number..."
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    data-testid="input-phone-number"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={handleAddParticipant}
                    data-testid="button-add-participant"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {(participants.length > 0 || failedParticipants.length > 0) && (
                <div className="flex flex-col gap-2 mt-2">
                  {/* Regular participants */}
                  {participants.filter(p => !failedParticipants.some(f => f.number === p)).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {participants
                        .filter(p => !failedParticipants.some(f => f.number === p))
                        .map((phone) => (
                          <Badge
                            key={phone}
                            variant="secondary"
                            className="pr-1 flex items-center gap-1"
                          >
                            {phone}
                            <button
                              type="button"
                              className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-foreground/10 transition-colors"
                              onClick={() => handleRemoveParticipant(phone)}
                              data-testid={`button-remove-participant-${phone}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                    </div>
                  )}
                  
                  {/* Failed participants with strikethrough */}
                  {failedParticipants.length > 0 && (
                    <div className="space-y-1">
                      {failedParticipants.map((failed) => (
                        <div key={failed.number} className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="pr-1 flex items-center gap-1 opacity-60"
                            >
                              <span className="line-through">{failed.number}</span>
                              <button
                                type="button"
                                className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-foreground/10 transition-colors"
                                onClick={() => {
                                  setFailedParticipants(prev => prev.filter(f => f.number !== failed.number));
                                  setParticipants(prev => prev.filter(p => p !== failed.number));
                                }}
                                data-testid={`button-remove-failed-${failed.number}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          </div>
                          <span className="text-xs text-destructive ml-1">{failed.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {!createdGroupName && (
                <p className="text-xs text-muted-foreground">
                  {participants.length === 0
                    ? "Add phone numbers with country code (e.g., +1234567890)"
                    : `${participants.length} participant${participants.length === 1 ? "" : "s"} added`}
                </p>
              )}
            </div>

            {!createdGroupName && (
              <>
                <Separator />
                
                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">Members can</div>
                  
                  <label 
                    className="flex items-start gap-3 cursor-pointer"
                    data-testid="setting-edit-group"
                  >
                    <Pencil className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Edit group settings</div>
                      <div className="text-xs text-muted-foreground">
                        This includes the group name, icon, description, disappearing message timer, advanced chat privacy, and the ability to pin
                      </div>
                    </div>
                    <Checkbox 
                      checked={groupSettings.membersCanEditGroupSettings}
                      onCheckedChange={(checked) => setGroupSettings(s => ({ ...s, membersCanEditGroupSettings: checked === true }))}
                      className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      data-testid="checkbox-edit-group"
                    />
                  </label>

                  <label 
                    className="flex items-start gap-3 cursor-pointer"
                    data-testid="setting-send-messages"
                  >
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Send new messages</div>
                    </div>
                    <Checkbox 
                      checked={groupSettings.membersCanSendMessages}
                      onCheckedChange={(checked) => setGroupSettings(s => ({ ...s, membersCanSendMessages: checked === true }))}
                      className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      data-testid="checkbox-send-messages"
                    />
                  </label>

                  <label 
                    className="flex items-start gap-3 cursor-pointer"
                    data-testid="setting-add-members"
                  >
                    <UserPlus className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Add other members</div>
                    </div>
                    <Checkbox 
                      checked={groupSettings.membersCanAddOthers}
                      onCheckedChange={(checked) => setGroupSettings(s => ({ ...s, membersCanAddOthers: checked === true }))}
                      className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      data-testid="checkbox-add-members"
                    />
                  </label>

                  <p className="text-xs text-muted-foreground">
                    Turning off these settings means that only group admins can perform this action.
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">Admins can</div>
                  
                  <div 
                    className="flex items-start gap-3 opacity-50 cursor-not-allowed"
                    data-testid="setting-approve-members"
                  >
                    <ShieldCheck className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Approve new members</div>
                      <div className="text-xs text-muted-foreground">
                        This setting is not currently supported by the WhatsApp API.
                      </div>
                    </div>
                    <Checkbox 
                      checked={false}
                      disabled
                      className="shrink-0"
                      data-testid="checkbox-approve-members"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {createdGroupName ? (
                <Button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    form.reset();
                    setParticipants([]);
                    setFailedParticipants([]);
                    setCreatedGroupName(null);
                    setImagePreview(null);
                    setIconFile(null);
                    setGroupSettings(defaultGroupSettings);
                  }}
                  data-testid="button-done-create-group"
                >
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    data-testid="button-cancel-create-group"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createGroupMutation.isPending || participants.length === 0}
                    data-testid="button-submit-create-group"
                  >
                    {createGroupMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Group"
                    )}
                  </Button>
                </>
              )}
            </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
