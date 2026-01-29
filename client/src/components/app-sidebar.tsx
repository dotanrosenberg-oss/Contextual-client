import { useState } from "react";
import { MessageSquare, Search, Settings, AlertCircle } from "lucide-react";
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
import type { Customer } from "@shared/schema";

interface AppSidebarProps {
  customers?: Customer[];
  selectedCustomerId?: string | null;
  onSelectCustomer?: (customerId: string) => void;
  connectionStatus?: "connected" | "disconnected" | "connecting";
  onSettingsClick?: () => void;
  isLoading?: boolean;
  error?: Error | null;
}

export function AppSidebar({
  customers = [],
  selectedCustomerId,
  onSelectCustomer,
  connectionStatus = "disconnected",
  onSettingsClick,
  isLoading = false,
  error = null,
}: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Contextful</span>
        </div>
        <ConnectionStatus status={connectionStatus} className="mt-2" />
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
        <SyncButton disabled={connectionStatus !== "connected"} />
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
