import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

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

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === "new_message" || message.type === "message_update") {
            queryClient.invalidateQueries({
              queryKey: ["/api/wa/customers"],
            });
            const msgData = message.data as { customerId?: string };
            if (msgData?.customerId) {
              queryClient.invalidateQueries({
                queryKey: ["/api/wa/customers", msgData.customerId, "messages"],
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
