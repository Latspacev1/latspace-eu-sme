import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserRole, FilterState } from "../types";
import { authApi } from "../api/auth";
import { apiClient } from "../api/client";

interface User {
  username: string;
  email: string;
  role: UserRole;
  displayName: string;
  userId: string;
  orgId: string;
  plantId: string | null;
}

interface AppState {
  // Authentication
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  currentRole: UserRole | null;
  setCurrentRole: (role: UserRole) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;

  // Global Welcome Animation
  welcomeState: {
    isVisible: boolean;
    isExiting: boolean;
    userName: string;
  };
  triggerWelcome: (userName: string) => void;
  dismissWelcome: () => void;
}

const defaultFilters: FilterState = {
  year: 2024,
};

function mapBackendRoleToFrontend(_backendRole: string): UserRole {
  return "CorporateHead";
}

function getDisplayNameFromRole(_role: UserRole): string {
  return "Corporate Head";
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      // Set up API client token getter
      apiClient.setTokenGetter(() => get().token);
      // Set up API client auth error handler — redirect to login on 401
      apiClient.setAuthErrorHandler(() => {
        get().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      });

      return {
        // Authentication state
        isAuthenticated: false,
        user: null,
        token: null,
        currentRole: null,
        setCurrentRole: (role: UserRole) => set({ currentRole: role }),

        // Sidebar state
        sidebarCollapsed: false,
        toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

        login: async (email: string, password: string) => {
          try {
            const response = await authApi.login(email, password);

            if (response.success && response.data) {
              const { token, payload } = response.data;
              const frontendRole = mapBackendRoleToFrontend(payload.role);

              set({
                isAuthenticated: true,
                token: token,
                user: {
                  username: payload.username,
                  email: payload.email,
                  role: frontendRole,
                  displayName: getDisplayNameFromRole(frontendRole),
                  userId: payload.user_id,
                  orgId: payload.org_id,
                  plantId: payload.plant_id || null,
                },
                currentRole: frontendRole,
              });

              return { success: true };
            } else {
              return {
                success: false,
                error: response.error || response.message || "Login failed",
              };
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : "Login failed",
            };
          }
        },
        logout: async () => {
          const token = get().token;
          if (token) {
            try {
              await authApi.logout(token);
            } catch (error) {
              // Continue with logout even if API call fails
              console.error("Logout API call failed:", error);
            }
          }
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            currentRole: null,
            filters: defaultFilters,
          });
        },
        refreshToken: async () => {
          const token = get().token;
          if (!token) {
            return false;
          }

          try {
            const response = await authApi.refreshToken();

            if (response.success && response.data) {
              const { token: newToken, payload } = response.data;
              const frontendRole = mapBackendRoleToFrontend(payload.role);

              set({
                token: newToken,
                user: {
                  username: payload.username,
                  email: payload.email,
                  role: frontendRole,
                  displayName: getDisplayNameFromRole(frontendRole),
                  userId: payload.user_id,
                  orgId: payload.org_id,
                  plantId: payload.plant_id || null,
                },
                currentRole: frontendRole,
              });

              return true;
            }
            return false;
          } catch (error) {
            console.error("Token refresh failed:", error);
            return false;
          }
        },

        filters: defaultFilters,
        setFilters: (newFilters) =>
          set((state) => ({
            filters: { ...state.filters, ...newFilters },
          })),
        resetFilters: () => set({ filters: defaultFilters }),

        // Global Welcome Animation
        welcomeState: {
          isVisible: false,
          isExiting: false,
          userName: "",
        },
        triggerWelcome: (userName: string) =>
          set({
            welcomeState: { isVisible: true, isExiting: false, userName },
          }),
        dismissWelcome: () => {
          set((state) => ({
            welcomeState: { ...state.welcomeState, isExiting: true },
          }));
          setTimeout(() => {
            set({
              welcomeState: { isVisible: false, isExiting: false, userName: "" },
            });
          }, 600); // Match globals.css animation duration
        },
      };
    },
    {
      name: "ccts-app-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : ({
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          length: 0,
          clear: () => {},
          key: () => null,
        } as Storage)
      ),
    }
  )
);

