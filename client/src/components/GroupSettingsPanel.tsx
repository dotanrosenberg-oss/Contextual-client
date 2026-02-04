import { useState, useEffect, useRef, useMemo } from "react";
import { useUpdateGroupSettings } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Pencil, MessageSquare, UserPlus, ShieldCheck, Settings, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface GroupSettingsPanelProps {
  groupId: string;
  disabled?: boolean;
}

export function GroupSettingsPanel({ groupId, disabled = false }: GroupSettingsPanelProps) {
  const [settings, setSettings] = useState<GroupSettings>(defaultGroupSettings);
  const initialSettingsRef = useRef<GroupSettings>(defaultGroupSettings);
  const updateSettingsMutation = useUpdateGroupSettings();
  const { toast } = useToast();

  useEffect(() => {
    initialSettingsRef.current = defaultGroupSettings;
    setSettings(defaultGroupSettings);
  }, [groupId]);

  const hasChanges = useMemo(() => {
    return (
      settings.membersCanEditGroupSettings !== initialSettingsRef.current.membersCanEditGroupSettings ||
      settings.membersCanSendMessages !== initialSettingsRef.current.membersCanSendMessages ||
      settings.membersCanAddOthers !== initialSettingsRef.current.membersCanAddOthers
    );
  }, [settings]);

  const handleSettingChange = (key: keyof GroupSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        customerId: groupId,
        settings: {
          membersCanEditSettings: settings.membersCanEditGroupSettings,
          membersCanSendMessages: settings.membersCanSendMessages,
          membersCanAddMembers: settings.membersCanAddOthers,
        },
      });
      
      initialSettingsRef.current = { ...settings };
      
      toast({
        title: "Settings updated",
        description: "Group settings have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to update settings",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium">Group Settings</span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Alert className="bg-muted/50" data-testid="alert-settings-info">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Current group settings cannot be retrieved from WhatsApp. Toggle the options below and save to update the settings.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Members can</div>
            
            <label 
              className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
              data-testid="setting-edit-group-existing"
            >
              <Pencil className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Edit group settings</div>
                <div className="text-xs text-muted-foreground">
                  This includes the group name, icon, description, disappearing message timer, advanced chat privacy, and the ability to pin
                </div>
              </div>
              <Checkbox 
                checked={settings.membersCanEditGroupSettings}
                onCheckedChange={(checked) => handleSettingChange('membersCanEditGroupSettings', checked === true)}
                disabled={disabled}
                className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                data-testid="checkbox-edit-group-existing"
              />
            </label>

            <label 
              className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
              data-testid="setting-send-messages-existing"
            >
              <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Send new messages</div>
              </div>
              <Checkbox 
                checked={settings.membersCanSendMessages}
                onCheckedChange={(checked) => handleSettingChange('membersCanSendMessages', checked === true)}
                disabled={disabled}
                className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                data-testid="checkbox-send-messages-existing"
              />
            </label>

            <label 
              className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
              data-testid="setting-add-members-existing"
            >
              <UserPlus className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Add other members</div>
              </div>
              <Checkbox 
                checked={settings.membersCanAddOthers}
                onCheckedChange={(checked) => handleSettingChange('membersCanAddOthers', checked === true)}
                disabled={disabled}
                className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                data-testid="checkbox-add-members-existing"
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
              data-testid="setting-approve-members-existing"
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
                data-testid="checkbox-approve-members-existing"
              />
            </div>
          </div>
        </div>
      </ScrollArea>
      
      {hasChanges && (
        <div className="p-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending || disabled}
            className="w-full"
            data-testid="button-save-group-settings"
          >
            {updateSettingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
