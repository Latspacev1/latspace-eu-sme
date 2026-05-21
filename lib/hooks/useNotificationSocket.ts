"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store/useAppStore";
import { toast } from "sonner";

interface NotificationData {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  [key: string]: unknown;
}

interface WebSocketMessage {
  type: string;
  notification?: NotificationData;
  notification_id?: string;
  data?: Record<string, unknown>;
  success?: boolean;
  error?: string;
  message?: string;
}

interface UseNotificationSocketOptions {
  /** Whether to show toast notifications for new notifications. Default: true */
  showToasts?: boolean;
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
  /** Mark a notification as read via WebSocket */
  markAsRead: (notificationId: string) => void;
}

/**
 * Hook for managing real-time notification WebSocket connection.
 *
 * This hook establishes a WebSocket connection to receive notifications in real-time,
 * eliminating the need for polling. It handles:
 * - Authentication via JWT token
 * - Automatic reconnection on disconnect
 * - Keep-alive pings
 * - Optimistic cache updates via TanStack Query
 *
 * @example
 * ```tsx
 * function NotificationsBell() {
 *   const { isConnected } = useNotificationSocket();
 *   // Notifications are automatically updated in the query cache
 * }
 * ```
 */
export function useNotificationSocket(
  options: UseNotificationSocketOptions = {}
): UseNotificationSocketReturn {
  const {
    showToasts = true,
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

  const queryClient = useQueryClient();
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

          case "new_notification":
            if (data.notification) {
              const newNotification = data.notification;
              // Optimistically update the notifications cache
              queryClient.setQueryData<NotificationData[]>(["notifications"], (old = []) => {
                // Avoid duplicates
                const exists = old.some((n) => n.id === newNotification.id);
                if (exists) return old;
                return [newNotification, ...old];
              });

              // Invalidate unread count
              queryClient.invalidateQueries({
                queryKey: ["notifications", "unread-count"],
              });

              // Show toast for new notification
              if (showToasts && newNotification.title) {
                toast.info(newNotification.title, {
                  description: newNotification.message,
                  action: newNotification.actionUrl
                    ? {
                      label: "View",
                      onClick: () => {
                        window.location.href = newNotification.actionUrl!;
                      },
                    }
                    : undefined,
                });
              }
            }
            break;

          case "notification_read":
            if (data.success && data.notification_id) {
              const notificationId = data.notification_id;
              // Update the notification in cache
              queryClient.setQueryData<NotificationData[]>(["notifications"], (old = []) =>
                old.map((n) =>
                  n.id === notificationId
                    ? { ...n, isRead: true, readAt: new Date().toISOString() }
                    : n
                )
              );
            }
            break;

          case "notification_deleted":
            if (data.notification_id) {
              const deletedId = data.notification_id;
              queryClient.setQueryData<NotificationData[]>(["notifications"], (old = []) =>
                old.filter((n) => n.id !== deletedId)
              );
            }
            break;

          case "unread_count":
            // Invalidate to refetch
            queryClient.invalidateQueries({
              queryKey: ["notifications", "unread-count"],
            });
            break;

          case "pong":
            // Keep-alive response received
            break;

          case "error":
            console.error("[WS] Server error:", data.message);
            break;

          default:
            // Unknown message type - ignore silently
            break;
        }
      } catch {
        // Failed to parse message - ignore silently
      }
    },
    [onMessage, queryClient, showToasts]
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

  const markAsRead = useCallback((notificationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "mark_as_read",
          notification_id: notificationId,
        })
      );
    }
  }, []);

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
    markAsRead,
  };
}
