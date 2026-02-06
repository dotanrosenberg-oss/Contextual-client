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
  deleteCachedMessage,
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

interface AttachmentData {
  file: File;
  preview: string | null;
  type: "image" | "video" | "audio" | "document";
}

interface SendMessageVariables {
  customerId: string;
  message: string;
  attachment?: AttachmentData;
}

interface SendPollVariables {
  customerId: string;
  question: string;
  options: string[];
  allowMultipleAnswers?: boolean;
}

interface PollMessage extends Message {
  pollQuestion?: string | null;
  pollOptions?: string[] | null;
  allowMultipleAnswers?: boolean;
}

interface SendPollResponse {
  success: boolean;
  message?: PollMessage;
}

export function useSendPoll() {
  const queryClient = useQueryClient();
  
  return useMutation<SendPollResponse, Error, SendPollVariables>({
    mutationFn: async ({ customerId, question, options, allowMultipleAnswers = false }) => {
      if (!customerId) throw new Error("No customer selected");
      
      const url = `/api/wa/customers/${encodeURIComponent(customerId)}/poll`;
      const res = await apiRequest("POST", url, { question, options, allowMultipleAnswers });
      const data = await res.json();
      
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        throw new Error("Poll endpoint returned empty response - poll feature may not be supported by the WhatsApp server");
      }
      
      if (data.error) {
        throw new Error(data.message || data.error);
      }
      
      return data;
    },
    onSuccess: async (response, variables) => {
      if (response.message) {
        const pollMsg = response.message;
        
        await cacheMessages([pollMsg]).catch(() => {});
        
        const msgTimestamp = new Date(pollMsg.timestamp).getTime();
        await updateSyncMeta({
          key: `messages-${variables.customerId}`,
          lastSyncTimestamp: msgTimestamp,
        }).catch(() => {});
        
        queryClient.setQueryData(
          ["/api/wa/customers", variables.customerId, "messages"],
          (old: unknown) => {
            const oldMessages = (old as PollMessage[] | undefined) || [];
            const exists = oldMessages.some((m) => m.id === pollMsg.id);
            if (exists) return oldMessages;
            const updated = [...oldMessages, pollMsg];
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
      
      queryClient.invalidateQueries({
        queryKey: ["/api/wa/customers", variables.customerId, "messages"],
      });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation<SendMessageResponse, Error, SendMessageVariables>({
    mutationFn: async ({ customerId, message, attachment }: SendMessageVariables) => {
      if (!customerId) throw new Error("No customer selected");
      
      const url = `/api/wa/customers/${encodeURIComponent(customerId)}/messages`;
      
      if (attachment) {
        const formData = new FormData();
        formData.append("file", attachment.file);
        if (message.trim()) {
          formData.append("caption", message);
        }
        
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text || res.statusText}`);
        }
        
        return res.json();
      } else {
        const res = await apiRequest("POST", url, { message });
        return res.json();
      }
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

interface EditMessageVariables {
  customerId: string;
  messageId: string;
  message: string;
}

interface EditMessageResponse {
  success: boolean;
  message?: Message;
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation<EditMessageResponse, Error, EditMessageVariables>({
    mutationFn: async ({ customerId, messageId, message }) => {
      const url = `/api/wa/customers/${encodeURIComponent(customerId)}/messages/${encodeURIComponent(messageId)}`;
      const res = await apiRequest("PATCH", url, { message });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      return data;
    },
    onSuccess: async (response, variables) => {
      const updatedMsg = response.message;

      queryClient.setQueryData<Message[]>(
        ["/api/wa/customers", variables.customerId, "messages"],
        (old) => {
          if (!old) return old;
          return old.map((m) => {
            if (m.id !== variables.messageId) return m;
            if (updatedMsg) {
              return { ...m, ...updatedMsg, isEdited: true };
            }
            return { ...m, body: variables.message, isEdited: true };
          });
        }
      );

      if (updatedMsg) {
        await cacheMessages([{ ...updatedMsg, isEdited: true } as Message]).catch(() => {});
      }
    },
  });
}

interface DeleteMessageVariables {
  customerId: string;
  messageId: string;
}

interface DeleteMessageResponse {
  success: boolean;
  messageId?: string;
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation<DeleteMessageResponse, Error, DeleteMessageVariables>({
    mutationFn: async ({ customerId, messageId }) => {
      const url = `/api/wa/customers/${encodeURIComponent(customerId)}/messages/${encodeURIComponent(messageId)}`;
      const res = await apiRequest("DELETE", url);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      return data;
    },
    onSuccess: async (_response, variables) => {
      queryClient.setQueryData<Message[]>(
        ["/api/wa/customers", variables.customerId, "messages"],
        (old) => {
          if (!old) return old;
          return old.filter((m) => m.id !== variables.messageId);
        }
      );

      await deleteCachedMessage(variables.messageId).catch(() => {});

      queryClient.invalidateQueries({
        queryKey: ["/api/wa/customers", variables.customerId, "messages"],
      });
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

interface GroupSettings {
  membersCanEditSettings?: boolean;
  membersCanSendMessages?: boolean;
  membersCanAddMembers?: boolean;
}

interface CreateGroupPayload {
  name: string;
  participants: string[];
  iconFile?: File;
  settings?: GroupSettings;
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
  appliedSettings?: {
    membersCanEditSettings: boolean;
    membersCanSendMessages: boolean;
    membersCanAddMembers: boolean;
  };
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
      let res: Response;
      
      if (payload.iconFile) {
        // Use FormData when there's an icon file
        const formData = new FormData();
        formData.append("name", payload.name);
        formData.append("participants", JSON.stringify(payload.participants));
        if (payload.settings) {
          formData.append("settings", JSON.stringify(payload.settings));
        }
        formData.append("icon", payload.iconFile);
        
        res = await fetch("/api/wa/groups/create", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      } else {
        // Use JSON when there's no icon
        res = await fetch("/api/wa/groups/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            participants: payload.participants,
            settings: payload.settings,
          }),
          credentials: "include",
        });
      }
      
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

interface GroupSettingsResponse {
  membersCanEditSettings: boolean;
  membersCanSendMessages: boolean;
  membersCanAddMembers: boolean;
  lastUpdated?: string;
  source?: string;
}

export function useGroupSettings(groupId: string | null) {
  return useQuery<GroupSettingsResponse>({
    queryKey: [`/api/wa/customers/${groupId}/settings`],
    enabled: !!groupId,
    staleTime: 5000,
    refetchOnMount: 'always',
  });
}

interface UpdateGroupSettingsPayload {
  customerId: string;
  settings: GroupSettings;
}

interface UpdateGroupSettingsResponse {
  membersCanEditSettings: boolean;
  membersCanSendMessages: boolean;
  membersCanAddMembers: boolean;
  lastUpdated?: string;
  source?: string;
}

export function useUpdateGroupSettings() {
  const qc = useQueryClient();
  
  return useMutation<UpdateGroupSettingsResponse, Error, UpdateGroupSettingsPayload>({
    mutationFn: async ({ customerId, settings }) => {
      const res = await fetch(`/api/wa/customers/${encodeURIComponent(customerId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        credentials: "include",
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to update group settings");
      }
      
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const queryKey = [`/api/wa/customers/${variables.customerId}/settings`];
      
      qc.setQueryData<GroupSettingsResponse>(queryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          ...variables.settings,
          lastUpdated: new Date().toISOString(),
        };
      });
      
      setTimeout(() => {
        qc.invalidateQueries({ queryKey });
      }, 3000);
    },
  });
}
