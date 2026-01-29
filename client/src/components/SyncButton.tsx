import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSyncCustomers } from "@/lib/api";

interface SyncButtonProps {
  disabled?: boolean;
}

export function SyncButton({ disabled }: SyncButtonProps) {
  const { toast } = useToast();
  const syncMutation = useSyncCustomers();

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${result.count ?? 0} customers`,
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={disabled || syncMutation.isPending}
      className="w-full"
      data-testid="button-sync"
    >
      {syncMutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Sync Customers
        </>
      )}
    </Button>
  );
}
