/**
 * Centralized API client for backend communication
 */

// Next.js replaces NEXT_PUBLIC_* env vars at build time
// Use a getter function to access at runtime
export function getBackendUrl(): string {
  // With nginx reverse proxy, use relative URLs (same origin = no CORS issues)
  // @ts-ignore - Next.js makes process.env available in browser for NEXT_PUBLIC_*
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  // If explicitly set (for direct backend access without nginx), use it
  if (envUrl) {
    return envUrl;
  }

  // Default: Use relative URL (nginx will proxy /api to backend)
  // This works because nginx proxies /api/* to backend:8000
  return "";
}

export interface APIResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  _status?: number;
}

class ApiClient {
  private getToken: (() => string | null) | null = null;
  private onAuthError: (() => void) | null = null;

  constructor() {
    // No baseURL stored - computed dynamically
  }

  setTokenGetter(getter: () => string | null) {
    this.getToken = getter;
  }

  setAuthErrorHandler(handler: () => void) {
    this.onAuthError = handler;
  }

  private getBaseURL(): string {
    return getBackendUrl();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<APIResponse<T>> {
    const baseURL = this.getBaseURL();
    // If baseURL is empty (nginx proxy), use relative URL
    // Otherwise, construct full URL
    const url = baseURL ? `${baseURL.replace(/\/$/, "")}${endpoint}` : endpoint;
    const token = this.getToken?.() || null;

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Only set Content-Type: application/json if not already set and not FormData
    if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    // Inject token unless the caller explicitly opted out by setting Authorization: ""
    if (token && headers["Authorization"] !== "") {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Remove the empty Authorization placeholder so it isn't sent over the wire
    if (headers["Authorization"] === "") {
      delete headers["Authorization"];
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Trigger auth error handler on 401 so the app can redirect to login
        if (response.status === 401 && this.onAuthError) {
          this.onAuthError();
        }
        return {
          success: false,
          message: data.detail || data.message || "Request failed",
          error: data.error || data.detail,
          _status: response.status,
        };
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          message: error.message,
          error: error.message,
          _status: 0,
        };
      }
      return {
        success: false,
        message: "Network error",
        error: "Network error",
        _status: 0,
      };
    }
  }

  async get<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();

/**
 * Centralised 401 handler for blob-download methods that bypass the apiClient
 * request path. Logs out and redirects to /login.
 */
export function handleAuthError(): void {
  // Dynamic import avoids a circular dep: store → client → store
  import("../store/useAppStore").then(({ useAppStore }) => {
    useAppStore.getState().logout();
  });
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

/**
 * Returns the current bearer token from the Zustand store.
 * Uses the same dynamic-require pattern as handleAuthError to avoid circular deps.
 */
export function getBearerToken(): string | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("../store/useAppStore") as { useAppStore: { getState: () => { token: string | null } } }).useAppStore.getState().token;
}
