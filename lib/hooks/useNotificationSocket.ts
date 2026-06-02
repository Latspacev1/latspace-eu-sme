"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";

interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  success?: boolean;
  error?: string;
  message?: string;
}

interface UseNotificationSocketOptions {
  /** Reconnection delay in ms. Default: 3000 */
  reconnectDelay?: number;
  /** Maximum reconnection attempts. Default: 5 */
  maxReconnectAttempts?: number;
  /** Ping interval in ms to keep connection alive. Default: 30000 */
  pingInterval?: number;
  /** Optional callback for every incoming message */
  onMessage?: (message: WebSocketMessage) => void;
}

interface UseNotificationSocketReturn {
  /** Whether the WebSocket is currently connected */
  isConnected: boolean;
  /** Manually reconnect the WebSocket */
  reconnect: () => void;
}

/**
 * Hook for managing a real-time WebSocket connection.
 *
 * Establishes an authenticated WebSocket connection and forwards incoming
 * messages to an optional `onMessage` callback. It handles:
 * - Authentication via JWT token
 * - Automatic reconnection on disconnect
 * - Keep-alive pings
 *
 * Consumers (e.g. useJobStatusSocket) build their own message handling on top
 * via the `onMessage` callback.
 */
export function useNotificationSocket(
  options: UseNotificationSocketOptions = {}
): UseNotificationSocketReturn {
  const {
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    pingInterval = 30000,
    onMessage,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to hold the connect function for use in event handlers
  const connectRef = useRef<(() => void) | null>(null);

  // State for connection status (exposed to consumers)
  const [isConnected, setIsConnected] = useState(false);

  const { user, token } = useAppStore();

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        onMessage?.(data);

        switch (data.type) {
          case "connected":
            setIsConnected(true);
            reconnectAttemptsRef.current = 0;
            break;

          case "pong":
            // Keep-alive response received
            break;

          case "error":
            console.error("[WS] Server error:", data.message);
            break;

          default:
            // Other message types are handled by consumers via onMessage
            break;
        }
      } catch {
        // Failed to parse message - ignore silently
      }
    },
    [onMessage]
  );

  const connect = useCallback(() => {
    if (!user || !token) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    clearTimers();

    // Determine WebSocket URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    let wsUrl: string;

    if (backendUrl) {
      // Convert HTTP URL to WebSocket URL
      const url = new URL(backendUrl);
      const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${wsProtocol}//${url.host}/api/ws/notifications?token=${token}`;
    } else {
      // Fallback for local development
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/api/ws/notifications?token=${token}`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, pingInterval);
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        setIsConnected(false);
        clearTimers();

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = reconnectDelay * reconnectAttemptsRef.current;
          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
          }, delay);
        }
      };

      ws.onerror = () => {
        // WebSocket error - will trigger onclose
      };
    } catch {
      // Failed to create WebSocket - ignore silently
    }
  }, [user, token, handleMessage, clearTimers, reconnectDelay, maxReconnectAttempts, pingInterval]);

  // Update the ref whenever connect changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Connect when user and token are available
  useEffect(() => {
    if (user && token) {
      connect();
    }

    return () => {
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [user, token, connect, clearTimers]);

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user && !isConnected) {
        reconnect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, reconnect, isConnected]);

  return {
    isConnected,
    reconnect,
  };
}
