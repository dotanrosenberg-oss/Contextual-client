import { useState } from "react";
import { Search, Settings, AlertCircle, Smartphone } from "lucide-react";
import logoImage from "@assets/Gemini_Generated_Image_f014s7f014s7f014_1769729881969.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionStatus } from "./ConnectionStatus";
import { CustomerListItem } from "./CustomerListItem";
import { SyncButton } from "./SyncButton";
import { CreateGroupDialog } from "./CreateGroupDialog";
import type { Customer } from "@shared/schema";

interface AppSidebarProps {
  customers?: Customer[];
  selectedCustomerId?: string | null;
  onSelectCustomer?: (customerId: string) => void;
  serverStatus?: "connected" | "disconnected" | "connecting";
  serviceStatus?: "connected" | "disconnected" | "connecting";
  onSettingsClick?: () => void;
  isLoading?: boolean;
  error?: Error | null;
  isWhatsAppNotLinked?: boolean;
}

export function AppSidebar({
  customers = [],
  selectedCustomerId,
  onSelectCustomer,
  serverStatus = "disconnected",
  serviceStatus = "disconnected",
  onSettingsClick,
  isLoading = false,
  error = null,
  isWhatsAppNotLinked = false,
}: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = customers
    .filter((customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const rawTimeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const rawTimeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      const timeA = Number.isFinite(rawTimeA) ? rawTimeA : 0;
      const timeB = Number.isFinite(rawTimeB) ? rawTimeB : 0;
      return timeB - timeA;
    });

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Contextify" className="h-10 w-10 rounded-lg" />
          <div className="flex flex-col">
            <span className="text-lg font-bold">Contextify</span>
            <span className="text-xs text-muted-foreground">Intelligent Unification</span>
          </div>
        </div>
        <ConnectionStatus serverStatus={serverStatus} serviceStatus={serviceStatus} className="mt-2" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="input-search-customers"
              />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex-1">
          <SidebarGroupContent className="px-2">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <SidebarMenu>
                {isLoading ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isWhatsAppNotLinked ? (
                  <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                    <Smartphone className="h-8 w-8 text-amber-500" />
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">WhatsApp Not Linked</p>
                    <p className="text-xs text-muted-foreground">Connect your WhatsApp to see chats</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-sm font-medium text-destructive">Failed to load chats</p>
                    <p className="text-xs text-muted-foreground">{error.message}</p>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {searchQuery ? "No chats found" : "No conversations yet"}
                  </div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <SidebarMenuItem key={customer.id}>
                      <CustomerListItem
                        id={customer.id}
                        name={customer.name}
                        avatarUrl={customer.avatarUrl}
                        lastMessage={customer.lastMessage}
                        lastMessageTime={customer.lastMessageTime}
                        unreadCount={customer.unreadCount ?? 0}
                        isSelected={selectedCustomerId === customer.id}
                        onClick={() => onSelectCustomer?.(customer.id)}
                      />
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-2">
        <CreateGroupDialog disabled={serviceStatus !== "connected"} />
        <SyncButton disabled={serviceStatus !== "connected"} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onSettingsClick}
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
