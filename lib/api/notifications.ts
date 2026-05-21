import { apiClient, type APIResponse } from "./client";
import type { Notification } from "@/lib/types";

export interface NotificationResponse {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  recipientUserId: string;
  recipientRole: string;
  isRead: boolean;
  readAt?: string;
  requiresAction: boolean;
  actionUrl?: string;
  actionLabel?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  plantId?: string;
  plantName?: string;
  orgId?: string;
  senderUserId?: string;
  senderName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export const notificationsApi = {
  /**
   * Get all notifications for the current user
   */
  getAll: async (params?: {
    is_read?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<APIResponse<NotificationResponse[]>> => {
    const searchParams = new URLSearchParams();
    if (params?.is_read !== undefined)
      searchParams.append("is_read", String(params.is_read));
    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.skip) searchParams.append("skip", String(params.skip));

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/api/notifications?${queryString}`
      : "/api/notifications";

    return apiClient.get<NotificationResponse[]>(endpoint);
  },

  /**
   * Get count of unread notifications
   */
  getUnreadCount: async (): Promise<APIResponse<{ count: number }>> => {
    return apiClient.get<{ count: number }>("/api/notifications/unread-count");
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (
    id: string,
  ): Promise<APIResponse<NotificationResponse>> => {
    return apiClient.post(`/api/notifications/${id}/read`, {});
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<APIResponse<{ modified_count: number }>> => {
    return apiClient.post("/api/notifications/mark-all-read", {});
  },

  /**
   * Delete a notification
   */
  delete: async (id: string): Promise<APIResponse<{ deleted_id: string }>> => {
    return apiClient.delete(`/api/notifications/${id}`);
  },
};
