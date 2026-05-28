import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types/navpro";
import { navproApi } from "@/services/api";

/**
 * SECURITY: Token is stored in module-level memory ONLY — never in
 * localStorage, sessionStorage, or cookies accessible to JS.
 * This eliminates XSS-based token theft.
 *
 * Trade-off: user must re-login after page refresh.
 * The persisted state below only stores non-sensitive metadata for UX
 * (to show the user's name immediately on load, while /me re-validates).
 */
let _inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  return _inMemoryToken;
}

export function setAuthToken(token: string | null): void {
  _inMemoryToken = token;
  // Also clean up any legacy localStorage token that may have been stored before this update
  if (typeof window !== "undefined") {
    localStorage.removeItem("navpro_token");
  }
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  backendOnline: boolean | null;
  effectiveRole: () => User["role"] | null;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setBackendOnline: (online: boolean | null) => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      backendOnline: null,
      effectiveRole: () => {
        const s = get();
        return s.user?.role || null;
      },
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setBackendOnline: (backendOnline) => set({ backendOnline }),
      hydrate: async () => {
        set({ isLoading: true });

        // Clean up any legacy localStorage token
        if (typeof window !== "undefined") {
          localStorage.removeItem("navpro_token");
        }

        // Check backend health (non-blocking)
        try {
          const health = await navproApi.health();
          set({ backendOnline: health?.status === "ok" });
        } catch {
          set({ backendOnline: false });
        }

        // No in-memory token → not authenticated (after page refresh, must re-login)
        if (!_inMemoryToken) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        // Validate token is still valid server-side
        try {
          const { user } = await navproApi.me();
          set({ user, isAuthenticated: true, isLoading: false, backendOnline: true });
        } catch {
          // Token invalid/expired — clear everything
          setAuthToken(null);
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
      logout: async () => {
        await navproApi.logout();
        setAuthToken(null);
        set({ user: null, isAuthenticated: false, isLoading: false });
      },
    }),
    {
      name: "navpro-auth",
      // SECURITY: Only persist non-sensitive user metadata for UX.
      // Token is NEVER persisted. User must re-login after page refresh.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // After storage rehydration, always re-validate with server
        // (persisted state is just a UX hint, not a security gate)
        state?.hydrate();
      },
    }
  )
);

