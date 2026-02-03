import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiRequest, queryClient } from "./queryClient";
import type { Customer, Message, ContactInsight, Participant, FailedParticipant } from "@shared/schema";
import {
  getCachedMessages,
  cacheMessages,
  getCachedCustomers,
  cacheCustomers,
  getSyncMeta,
  updateSyncMeta,
} from "./messageCache";

interface ServerStatus {
  status?: string;
  message?: string;
  connected?: boolean;
  ready?: boolean;
  qrCode?: string;
  phoneNumber?: string;
}

interface SettingsResponse {
  configured: boolean;
  baseUrl?: string;
  apiKey?: string;
  updatedAt?: string;
}

interface SendMessageResponse {
  success: boolean;
  message?: Message;
}

export function useCustomers() {
  const query = useQuery<Customer[]>({
    queryKey: ["/api/wa/customers"],
    staleTime: 30000,
  });

  useEffect(() => {
    if (query.data && query.data.length > 0) {
      cacheCustomers(query.data);
    }
  }, [query.data]);

  const isLoading = query.isLoading;
  const data = query.data;

  useEffect(() => {
    if (isLoading && (!data || data.length === 0)) {
      getCachedCustomers().then((cached) => {
        if (cached.length > 0) {
          queryClient.setQueryData(["/api/wa/customers"], cached);
        }
      });
    }
  }, [isLoading, data]);

  return query;
}

export function useMessages(customerId: string | null) {
  const query = useQuery<Message[]>({
    queryKey: ["/api/wa/customers", customerId, "messages"],
    enabled: !!customerId,
    staleTime: 60000,
    queryFn: async () => {
      if (!customerId) return [];

      const syncKey = `messages-${customerId}`;
      let cachedMessages: Message[] = [];
      let syncMeta = null;
      let cacheReadFailed = false;
      
      try {
        syncMeta = await getSyncMeta(syncKey);
      } catch (e) {
        console.warn("Sync meta read failed:", e);
      }
      
      try {
        cachedMessages = await getCachedMessages(customerId);
      } catch (e) {
        console.warn("Cache read failed:", e);
        cacheReadFailed = true;
      }

      const lastSyncTimestamp = syncMeta?.lastSyncTimestamp || null;
      
      let url = `/api/wa/customers/${encodeURIComponent(customerId)}/messages`;
      if (lastSyncTimestamp) {
        url += `?since=${lastSyncTimestamp}`;
      }

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (cachedMessages.length > 0) {
          return cachedMessages;
        }
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }

      const serverMessages: Message[] = await res.json();
      
      const existingIds = new Set(cachedMessages.map((m) => m.id));
      const uniqueNewMessages = serverMessages.filter((m) => !existingIds.has(m.id));
      
      const allMessages = cacheReadFailed 
        ? serverMessages 
        : [...cachedMessages, ...uniqueNewMessages];
      allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      try {
        if (uniqueNewMessages.length > 0) {
          await cacheMessages(uniqueNewMessages);
        } else if (cacheReadFailed && serverMessages.length > 0) {
          await cacheMessages(serverMessages);
        }
        
        const latestTimestamp = allMessages.length > 0
          ? new Date(allMessages[allMessages.length - 1].timestamp).getTime()
          : Date.now();
        
        await updateSyncMeta({
          key: syncKey,
          lastSyncTimestamp: latestTimestamp,
        });
      } catch (e) {
        console.warn("Cache write failed:", e);
      }

      return allMessages;
    },
  });

  const msgIsLoading = query.isLoading;
  const msgData = query.data;

  useEffect(() => {
    if (customerId && msgIsLoading && (!msgData || msgData.length === 0)) {
      getCachedMessages(customerId).then((cached) => {
        if (cached.length > 0) {
          queryClient.setQueryData(
            ["/api/wa/customers", customerId, "messages"],
            cached
          );
        }
      }).catch(() => {});
    }
  }, [customerId, msgIsLoading, msgData]);

  return query;
}

interface SendMessageVariables {
  customerId: string;
  message: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation<SendMessageResponse, Error, SendMessageVariables>({
    mutationFn: async ({ customerId, message }: SendMessageVariables) => {
      if (!customerId) throw new Error("No customer selected");
      const res = await apiRequest(
        "POST",
        `/api/wa/customers/${encodeURIComponent(customerId)}/messages`,
        { message }
      );
      return res.json();
    },
    onSuccess: async (response, variables) => {
      if (response.message) {
        await cacheMessages([response.message]);
        
        const msgTimestamp = new Date(response.message.timestamp).getTime();
        await updateSyncMeta({
          key: `messages-${variables.customerId}`,
          lastSyncTimestamp: msgTimestamp,
        }).catch(() => {});
        
        queryClient.setQueryData<Message[]>(
          ["/api/wa/customers", variables.customerId, "messages"],
          (old) => {
            if (!old) return [response.message!];
            const exists = old.some((m) => m.id === response.message!.id);
            if (exists) return old;
            const updated = [...old, response.message!];
            updated.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            return updated;
          }
        );
      }
      
      queryClient.invalidateQueries({
        queryKey: ["/api/wa/customers"],
      });
    },
  });
}

export function useServerStatus() {
  return useQuery<ServerStatus>({
    queryKey: ["/api/wa/status"],
    refetchInterval: 10000,
  });
}

export function useSettings() {
  return useQuery<SettingsResponse>({
    queryKey: ["/api/settings"],
  });
}

export function useInsights(customerId: string | null) {
  return useQuery<ContactInsight | null>({
    queryKey: ["/api/insights", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<ContactInsight | null> => {
      if (!customerId) return null;
      const res = await fetch(`/api/insights/${encodeURIComponent(customerId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
      return res.json();
    },
  });
}

export function useGenerateInsights() {
  return useMutation({
    mutationFn: async (data: { customerId: string; messages: Message[] }) => {
      const response = await apiRequest("POST", "/api/insights/generate", data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights", variables.customerId] });
    },
  });
}

export function useSaveSettings() {
  return useMutation({
    mutationFn: async (data: { baseUrl: string; apiKey: string }) => {
      const response = await apiRequest("POST", "/api/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wa/status"] });
    },
  });
}

export async function testConnection(baseUrl: string, apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/status`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      return { success: false, message: `Connection failed: ${response.status} ${text || response.statusText}` };
    }
    
    const data = await response.json();
    return { success: true, message: data.connected ? "Connected successfully" : "Server reachable but not connected to WhatsApp" };
  } catch (error) {
    return { success: false, message: `Connection failed: ${(error as Error).message}` };
  }
}

export function useSyncCustomers() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/wa/customers/sync");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wa/customers"] });
    },
  });
}

interface ImportHistoryResponse {
  success: boolean;
  chatId: string;
  count: number;
  messages: Message[];
}

interface ParticipantsResponse {
  participants: Participant[];
}

export function useGroupParticipants(groupId: string | null, includePhotos: boolean = false) {
  return useQuery<ParticipantsResponse, Error, Participant[]>({
    queryKey: [`/api/wa/customers/${groupId}/participants?includePhotos=${includePhotos}`],
    enabled: !!groupId,
    staleTime: 60000,
    select: (data) => data.participants || [],
  });
}

interface CreateGroupPayload {
  name: string;
  participants: string[];
  image?: string;
}

interface CreateGroupResponse {
  success: boolean;
  groupId: string;
  groupName: string;
  results: {
    added: { number: string; whatsappId: string }[];
    failed: { number: string; reason: string }[];
  };
  summary: {
    totalRequested: number;
    successfullyAdded: number;
    failedToAdd: number;
  };
  customer?: Customer;
}

interface CreateGroupErrorResponse {
  success: false;
  error: string;
  message?: string;
  results?: {
    added: { number: string; whatsappId: string }[];
    failed: { number: string; reason: string }[];
  };
}

export class CreateGroupValidationError extends Error {
  public failedParticipants: { number: string; reason: string }[];
  public errorType: string;
  
  constructor(message: string, failedParticipants: { number: string; reason: string }[], errorType: string) {
    super(message);
    this.name = "CreateGroupValidationError";
    this.failedParticipants = failedParticipants;
    this.errorType = errorType;
  }
}

function parseCreateGroupError(data: CreateGroupErrorResponse): Error {
  if (data.error === "ALL_PARTICIPANTS_FAILED") {
    const failedNumbers = data.results?.failed || [];
    let message = "No participants could be added to the group.";
    if (failedNumbers.length === 1) {
      message = `The phone number ${failedNumbers[0].number} is not registered on WhatsApp or doesn't allow group invites.`;
    } else if (failedNumbers.length > 0) {
      message = `None of the phone numbers could be added. They may not be registered on WhatsApp or don't allow group invites.`;
    }
    return new CreateGroupValidationError(message, failedNumbers, data.error);
  }
  
  if (data.message) {
    return new Error(data.message);
  }
  
  return new Error("Failed to create group. Please try again.");
}

export function useCreateGroup() {
  const qc = useQueryClient();
  
  return useMutation<CreateGroupResponse, Error, CreateGroupPayload>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/wa/groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (!res.ok || data.success === false) {
        throw parseCreateGroupError(data);
      }
      
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/wa/customers"] });
    },
  });
}

export function useImportHistory() {
  const qc = useQueryClient();
  
  return useMutation<ImportHistoryResponse, Error, { customerId: string; limit?: number }>({
    mutationFn: async ({ customerId, limit = 200 }) => {
      const res = await fetch(
        `/api/wa/whatsapp/messages/${encodeURIComponent(customerId)}?limit=${limit}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
      return res.json();
    },
    onSuccess: async (response, variables) => {
      if (response.messages && response.messages.length > 0) {
        await cacheMessages(response.messages);
        
        const latestImportedTimestamp = response.messages.reduce((max, msg) => {
          const ts = new Date(msg.timestamp).getTime();
          return ts > max ? ts : max;
        }, 0);
        
        if (latestImportedTimestamp > 0) {
          const syncKey = `messages-${variables.customerId}`;
          const existingMeta = await getSyncMeta(syncKey).catch(() => null);
          const existingTimestamp = existingMeta?.lastSyncTimestamp || 0;
          const newTimestamp = Math.max(existingTimestamp, latestImportedTimestamp);
          
          await updateSyncMeta({
            key: syncKey,
            lastSyncTimestamp: newTimestamp,
          }).catch(() => {});
        }
        
        qc.setQueryData<Message[]>(
          ["/api/wa/customers", variables.customerId, "messages"],
          (old) => {
            const existingIds = new Set(old?.map((m) => m.id) || []);
            const newMsgs = response.messages.filter((m) => !existingIds.has(m.id));
            const all = [...(old || []), ...newMsgs];
            all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            return all;
          }
        );
      }
    },
  });
}

interface FailedParticipantsResponse {
  failedParticipants: FailedParticipant[];
}

export function useFailedParticipants(customerId: string | null) {
  return useQuery<FailedParticipantsResponse, Error, FailedParticipant[]>({
    queryKey: [`/api/customers/${customerId}/failed-participants`],
    enabled: !!customerId,
    staleTime: 60000,
    select: (data) => data.failedParticipants || [],
  });
}

interface SaveFailedParticipantsPayload {
  customerId: string;
  participants: { phoneNumber: string; reason: string }[];
}

export function useSaveFailedParticipants() {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: SaveFailedParticipantsPayload) => {
      const res = await apiRequest("POST", "/api/customers/failed-participants", payload);
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [`/api/customers/${variables.customerId}/failed-participants`] });
    },
  });
}

export function useDeleteFailedParticipant() {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, customerId }: { id: number; customerId: string }) => {
      const res = await apiRequest("DELETE", `/api/customers/failed-participants/${id}`);
      return { ...await res.json(), customerId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [`/api/customers/${data.customerId}/failed-participants`] });
    },
  });
}
