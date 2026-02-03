import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactAvatar } from "@/components/ContactAvatar";
import type { Contact } from "@shared/schema";

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/contacts"],
  });

  const contacts = data?.contacts ?? [];

  const filteredContacts = contacts
    .filter((contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-xl font-semibold mb-3">Contacts</h1>
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
              {!searchQuery && (
                <p className="text-xs mt-1">
                  Contacts will appear after syncing with WhatsApp
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-md hover-elevate cursor-pointer"
                  data-testid={`contact-item-${contact.id}`}
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

      {!isLoading && !error && (
        <div className="p-3 border-t text-center text-xs text-muted-foreground">
          {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
