import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Users, RefreshCw, ArrowLeft, MessageSquareText } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ContactAvatar } from "@/components/ContactAvatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useContactGroupEnrichment } from "@/lib/api";
import type { Contact } from "@shared/schema";

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent signals</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`} className="text-sm text-foreground/90">• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/contacts"],
  });

  const { data: enrichment, isLoading: enrichmentLoading, error: enrichmentError } = useContactGroupEnrichment(
    selectedPhone,
    refreshSeed > 0,
  );

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/contacts/sync");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contacts synced",
        description: `Found ${data.contacts?.length || 0} contacts from your groups.`,
      });
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Could not sync contacts. Check your WhatsApp connection.",
        variant: "destructive",
      });
    },
  });

  const contacts = data?.contacts ?? [];

  const filteredContacts = contacts
    .filter((contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedContact = filteredContacts.find((c) => c.phone === selectedPhone) || contacts.find((c) => c.phone === selectedPhone) || null;

  return (
    <div className="flex h-full">
      <div className="flex flex-col h-full border-r min-w-[320px] max-w-[420px] w-full">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Back to conversations"
                  data-testid="button-back-to-conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-xl font-semibold">Contacts</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-contacts"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing..." : "Sync"}
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-contacts"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">Failed to load contacts</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? "No contacts found" : "No contacts yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`flex items-center gap-3 p-3 rounded-md hover-elevate cursor-pointer ${selectedPhone === contact.phone ? "bg-muted" : ""}`}
                    data-testid={`contact-item-${contact.id}`}
                    onClick={() => {
                      setSelectedPhone(contact.phone);
                      setRefreshSeed(0);
                    }}
                  >
                    <ContactAvatar
                      name={contact.name}
                      imageUrl={contact.profilePicUrl ?? undefined}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{contact.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 min-w-0">
        {!selectedContact ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <MessageSquareText className="h-10 w-10 opacity-50" />
            <p className="text-sm">Select a contact to view group enrichment</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ContactAvatar
                    name={selectedContact.name}
                    imageUrl={selectedContact.profilePicUrl ?? undefined}
                    size="md"
                  />
                  <div>
                    <p className="font-semibold">{selectedContact.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRefreshSeed((prev) => prev + 1)}
                  data-testid="button-refresh-group-enrichment"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
              </div>

              {enrichmentLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="border rounded-md p-4 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  ))}
                </div>
              ) : enrichmentError ? (
                <p className="text-sm text-destructive">Failed to load group enrichment.</p>
              ) : !enrichment || enrichment.groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No groups found for this contact.</p>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">
                    {enrichment.groups.length} group{enrichment.groups.length !== 1 ? "s" : ""} • {enrichment.cached ? "Cached" : "Fresh"}
                  </div>
                  {enrichment.groups.map((group) => (
                    <div key={group.groupId} className="border rounded-lg p-4 space-y-3" data-testid={`group-summary-${group.groupId}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{group.groupName}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.participantCount ? `${group.participantCount} members` : "Group"}
                            {group.summary.lastActivityAt ? ` • Active ${new Date(group.summary.lastActivityAt).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary">{group.summary.mainTopics.length} topics</Badge>
                      </div>

                      {group.summary.mainTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {group.summary.mainTopics.map((topic) => (
                            <Badge key={`${group.groupId}-${topic}`} variant="outline">{topic}</Badge>
                          ))}
                        </div>
                      )}

                      <SummaryList title="Key decisions" items={group.summary.keyDecisions} />
                      <SummaryList title="Open asks / blockers" items={group.summary.openAsksOrBlockers} />
                      <SummaryList title="Contact mentions" items={group.summary.contactMentions} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
