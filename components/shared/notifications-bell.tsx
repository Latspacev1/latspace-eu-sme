"use client";

import React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, AlertCircle, CheckCircle, Clock, FileText, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Notification, NotificationType, NotificationPriority, UserRole } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useAppStore } from "@/lib/store/useAppStore";
import { notificationsApi } from "@/lib/api/notifications";
import { toast } from "sonner";
import { useNotificationSocket } from "@/lib/hooks/useNotificationSocket";

const notificationIcons: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  DataRejected: AlertCircle,
  DataApproved: CheckCircle,
  DataPendingApproval: Clock,
  ApprovalRequired: Clock,
  ChangeRequested: AlertCircle,
  DeadlineReminder: AlertTriangle,
  ComplianceAlert: AlertTriangle,
  DataGap: AlertCircle,
  DocumentExpiring: FileText,
};

const priorityColors = {
  Low: "bg-blue-50 text-blue-700",
  Medium: "bg-orange-50 text-orange-700",
  High: "bg-red-50 text-red-700",
  Urgent: "bg-red-100 text-red-800",
};

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAppStore();

  // Use WebSocket for real-time notifications instead of polling
  // This hook handles connection, reconnection, and cache updates
  const { markAsRead: wsMarkAsRead } = useNotificationSocket({
    showToasts: false, // We handle toasts separately in the bell
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await notificationsApi.getAll();
      if (response.success && response.data) {
        // Map the API response to the Notification type expected by the component
        return response.data.map(
          (n): Notification => ({
            id: n.id,
            type: n.type as NotificationType,
            priority: n.priority as NotificationPriority,
            title: n.title,
            message: n.message,
            createdAt: n.createdAt,
            isRead: n.isRead,
            readAt: n.readAt,
            requiresAction: n.requiresAction,
            actionUrl: n.actionUrl,
            actionLabel: n.actionLabel,
            relatedEntityId: n.relatedEntityId,
            relatedEntityType: n.relatedEntityType as Notification["relatedEntityType"],
            recipientRole: n.recipientRole as UserRole,
            recipientUserId: n.recipientUserId,
            siteId: n.plantId,
            siteName: n.plantName,
            metadata: n.metadata,
          })
        );
      }
      return [];
    },
    enabled: !!user, // Only fetch when user is available
    // WebSocket handles real-time updates, no polling needed
    // Stale time is set globally in providers.tsx (5 minutes)
  });

  // Backend already filters by user ID, so no additional filtering needed here
  // Note: recipientRole comparison was removed due to format mismatch between backend
  // (snake_case: "plant_manager") and frontend (PascalCase: "PlantManager")
  const userNotifications = notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Calculate unread count from notifications array - this is the primary source
  // since we're already fetching all notifications
  // Make sure we're checking isRead correctly (handle both boolean and undefined)
  const unreadCount = userNotifications.filter(
    (n) => n.isRead === false || n.isRead === undefined
  ).length;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      // Try WebSocket first for instant feedback, fall back to REST
      wsMarkAsRead(notificationId);
      await notificationsApi.markAsRead(notificationId);
    },
    onMutate: async (notificationId: string) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<Notification[]>(["notifications"]);
      queryClient.setQueryData<Notification[]>(["notifications"], (old = []) =>
        old.map((n) =>
          n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      return { previous };
    },
    onError: (_err, _notificationId, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await notificationsApi.delete(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
    onError: () => {
      toast.error("Failed to delete notification");
    },
  });

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 text-xs font-semibold text-white bg-red-600 rounded-full flex items-center justify-center z-10">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 top-full mt-2 w-[450px] max-h-[650px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">{unreadCount} unread</p>
              )}
            </div>

            <div className="overflow-y-auto max-h-[570px]">
              {userNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No notifications</p>
                </div>
              ) : (
                <div>
                  {userNotifications.map((notification) => {
                    const Icon = notificationIcons[notification.type];

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 border-b border-gray-100 hover:bg-gray-50",
                          !notification.isRead && "bg-blue-50/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {notification.actionUrl ? (
                            <Link
                              href={notification.actionUrl}
                              className="flex-1"
                              onClick={() => {
                                if (!notification.isRead) {
                                  markAsReadMutation.mutate(notification.id);
                                }
                                setIsOpen(false);
                              }}
                            >
                              <NotificationContent notification={notification} Icon={Icon} />
                            </Link>
                          ) : (
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => {
                                if (!notification.isRead) {
                                  markAsReadMutation.mutate(notification.id);
                                }
                              }}
                            >
                              <NotificationContent notification={notification} Icon={Icon} />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                            className="p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                            aria-label="Delete notification"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationContent({
  notification,
  Icon,
}: {
  notification: Notification;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          priorityColors[notification.priority]
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
          {!notification.isRead && (
            <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
        <p className="text-xs text-gray-400 mt-2">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );
}
