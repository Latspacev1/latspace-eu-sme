import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserRole, FilterState } from "../types";
import { apiClient } from "../api/client";

// Minimal generic shape the auth layer maps a Clerk user into. Keeping this
// decoupled from Clerk's types lets the store stay provider-agnostic.
type SessionInput =
  | {
      id: string;
      email: string | null;
      fullName: string | null;
      avatarUrl: string | null;
    }
  | null;

interface User {
  username: string;
  email: string;
  role: UserRole;
  displayName: string;
  /** Active organization (company) name. Resolved server-side after sign-in. */
  companyName: string;
  userId: string;
  orgId: string;
  plantId: string | null;
}

interface AppState {
  // Authentication — hydrated from the Clerk session, NOT persisted.
  isAuthenticated: boolean;
  user: User | null;
  // Retained as `null` for backwards compatibility with non-auth callers that
  // still read `state.token` (lib/api/*). Auth now travels via Clerk cookies,
  // so there is no client-held bearer token anymore.
  token: string | null;
  currentRole: UserRole | null;
  setCurrentRole: (role: UserRole) => void;
  // Populated by the Clerk session-sync layer (AuthMiddleware via useUser).
  setSession: (input: SessionInput) => void;
  // Sets the active organization (company) name once resolved server-side.
  setCompanyName: (companyName: string) => void;
  logout: () => void;

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

// Default frontend role until a real org/role claim is wired in (task 7).
const DEFAULT_ROLE: UserRole = "CorporateHead";

function mapSessionInput(input: NonNullable<SessionInput>): User {
  const email = input.email ?? "";
  const label = input.fullName || email || "User";
  const role = DEFAULT_ROLE;
  return {
    username: label,
    email,
    role,
    displayName: label,
    // Resolved separately via setCompanyName once the active org is known.
    companyName: "",
    userId: input.id,
    // Server resolves the real org from the session; left empty on the client.
    orgId: "",
    plantId: null,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => {
      // Data routes now authenticate via same-origin cookies; there is no
      // client-held bearer token. Keep the getter wired so apiClient doesn't
      // crash, but it always returns null.
      apiClient.setTokenGetter(() => null);
      // On a 401 from the apiClient, clear local auth state and bounce to
      // login. Clerk's own session cookie is cleared on the next sign-in flow;
      // a hard navigation to /login lets middleware re-evaluate the session.
      apiClient.setAuthErrorHandler(() => {
        set({ isAuthenticated: false, user: null, currentRole: null });
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

        setSession: (input: SessionInput) => {
          if (!input) {
            set({ isAuthenticated: false, user: null, currentRole: null });
            return;
          }
          const user = mapSessionInput(input);
          set({
            isAuthenticated: true,
            user,
            currentRole: user.role,
          });
        },

        setCompanyName: (companyName: string) =>
          set((state) =>
            state.user ? { user: { ...state.user, companyName } } : {},
          ),

        // Clears local auth state only. Clerk's signOut() is a client hook, so
        // the component that calls logout() (e.g. CorporateSidebar via
        // useClerk().signOut) is responsible for ending the Clerk session.
        logout: () => {
          set({
            isAuthenticated: false,
            user: null,
            currentRole: null,
            filters: defaultFilters,
          });
        },

        // Sidebar state
        sidebarCollapsed: false,
        toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

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
      // Persist only non-auth UI slices. Auth is re-derived from the Clerk
      // session on every load via the AuthMiddleware session-sync layer.
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        filters: state.filters,
      }),
    }
  )
);
