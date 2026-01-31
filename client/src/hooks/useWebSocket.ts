import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cacheMessage, cacheMessages, updateCachedCustomer, updateSyncMeta } from "@/lib/messageCache";
import type { Message, Customer } from "@shared/schema";

export interface WebSocketMessage {
  type: string;
  data: unknown;
}

interface UseWebSocketOptions {
  apiKey: string | null;
  onMessage?: (message: WebSocketMessage) => void;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useWebSocket({ apiKey, onMessage }: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (!apiKey) {
      setStatus("disconnected");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?apiKey=${encodeURIComponent(apiKey)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
      };

      ws.onmessage = async (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === "message" || message.type === "new_message" || message.type === "message_update") {
            // Handle both formats:
            // - WA server sends: { type: "message", data: { id, body, customerId, ... } }
            // - Legacy format: { type: "new_message", data: { message: {...}, customerId } }
            const msgData = message.data as (Message & { message?: Message; customerId?: string });
            const actualMessage: Message | undefined = msgData?.message || (msgData?.id ? msgData as Message : undefined);
            
            if (actualMessage) {
              await cacheMessage(actualMessage);
              
              const customerId = msgData.customerId || actualMessage.customerId;
              if (customerId) {
                const msgTimestamp = new Date(actualMessage.timestamp).getTime();
                await updateSyncMeta({
                  key: `messages-${customerId}`,
                  lastSyncTimestamp: msgTimestamp,
                }).catch(() => {});
              }
              if (customerId) {
                queryClient.setQueryData<Message[]>(
                  ["/api/wa/customers", customerId, "messages"],
                  (old) => {
                    if (!old) return [actualMessage];
                    const exists = old.some((m) => m.id === actualMessage.id);
                    if (exists) {
                      return old.map((m) => 
                        m.id === actualMessage.id ? actualMessage : m
                      );
                    }
                    const updated = [...old, actualMessage];
                    updated.sort((a, b) => 
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );
                    return updated;
                  }
                );
              }
            }
            
            queryClient.invalidateQueries({
              queryKey: ["/api/wa/customers"],
            });
          }
          
          if (message.type === "messages_batch") {
            const batchData = message.data as { messages?: Message[]; customerId?: string };
            if (batchData?.messages && batchData.messages.length > 0) {
              await cacheMessages(batchData.messages);
              
              if (batchData.customerId) {
                const latestMsg = batchData.messages.reduce((latest, msg) => {
                  const msgTime = new Date(msg.timestamp).getTime();
                  return msgTime > latest ? msgTime : latest;
                }, 0);
                
                if (latestMsg > 0) {
                  await updateSyncMeta({
                    key: `messages-${batchData.customerId}`,
                    lastSyncTimestamp: latestMsg,
                  }).catch(() => {});
                }
                
                queryClient.invalidateQueries({
                  queryKey: ["/api/wa/customers", batchData.customerId, "messages"],
                });
              }
            }
          }
          
          if (message.type === "customer_update") {
            const custData = message.data as { customer?: Customer };
            if (custData?.customer) {
              await updateCachedCustomer(custData.customer);
              queryClient.invalidateQueries({
                queryKey: ["/api/wa/customers"],
              });
            }
          }

          if (message.type === "wa_connected") {
            queryClient.invalidateQueries({
              queryKey: ["/api/wa/status"],
            });
          }

          if (message.type === "wa_disconnected") {
            queryClient.invalidateQueries({
              queryKey: ["/api/wa/status"],
            });
          }

          onMessage?.(message);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        wsRef.current = null;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setStatus("disconnected");
    }
  }, [apiKey, onMessage, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    connect,
    disconnect,
  };
}
