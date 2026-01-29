import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type { Customer, Message, ContactInsight } from "@shared/schema";

interface ServerStatus {
  status: string;
  connected: boolean;
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
  return useQuery<Customer[]>({
    queryKey: ["/api/wa/customers"],
  });
}

export function useMessages(customerId: string | null) {
  return useQuery<Message[]>({
    queryKey: ["/api/wa/customers", customerId, "messages"],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return [];
      const res = await fetch(`/api/wa/customers/${encodeURIComponent(customerId)}/messages`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
      return res.json();
    },
  });
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
    onSuccess: (_, variables) => {
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
