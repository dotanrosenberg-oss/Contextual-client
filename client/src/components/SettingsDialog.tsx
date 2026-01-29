import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Loader2, CheckCircle, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSettings, useSaveSettings, testConnection } from "@/lib/api";

const settingsFormSchema = z.object({
  baseUrl: z
    .string()
    .min(1, "Server URL is required")
    .url("Must be a valid URL"),
  apiKey: z.string().min(1, "API Key is required"),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

interface SettingsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ trigger, open, onOpenChange }: SettingsDialogProps) {
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const saveSettingsMutation = useSaveSettings();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      baseUrl: "",
      apiKey: "",
    },
  });

  useEffect(() => {
    if (open && settings) {
      form.reset({
        baseUrl: settings.baseUrl || "",
        apiKey: "",
      });
      setTestResult(null);
    }
  }, [open, settings, form]);

  const handleTestConnection = async () => {
    const values = form.getValues();
    const validation = settingsFormSchema.safeParse(values);
    
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testConnection(values.baseUrl, values.apiKey);
    setTestResult(result);
    setIsTesting(false);

    toast({
      title: result.success ? "Connection Successful" : "Connection Failed",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
  };

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      await saveSettingsMutation.mutateAsync(values);
      toast({
        title: "Settings Saved",
        description: "Your WhatsApp server settings have been updated",
      });
      onOpenChange?.(false);
    } catch (error) {
      toast({
        title: "Failed to Save",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]" data-testid="dialog-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Connection Settings
          </DialogTitle>
          <DialogDescription>
            Configure your WhatsApp server connection. You'll need the server URL and API key.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://your-wa-server.com"
                      {...field}
                      data-testid="input-server-url"
                    />
                  </FormControl>
                  <FormDescription>
                    The URL of your WhatsApp server
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={settings?.configured ? "Enter new key or leave blank" : "Enter your API key"}
                      {...field}
                      data-testid="input-api-key"
                    />
                  </FormControl>
                  <FormDescription>
                    {settings?.configured && settings.apiKey
                      ? `Current: ${settings.apiKey}`
                      : "Your API key for authentication"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                  testResult.success
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-destructive/10 text-destructive"
                }`}
                data-testid="text-connection-result"
              >
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testResult.message}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
                data-testid="button-test-connection"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>

              <Button
                type="submit"
                disabled={saveSettingsMutation.isPending}
                data-testid="button-save-settings"
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
