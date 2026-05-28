import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types/navpro";
import { navproApi } from "@/services/api";

interface AuthState {
  user: User | null;
  roleOverride: User["role"] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  backendOnline: boolean | null;
  effectiveRole: () => User["role"] | null;
  setUser: (user: User | null) => void;
  setRoleOverride: (role: User["role"] | null) => void;
  setLoading: (isLoading: boolean) => void;
  setBackendOnline: (online: boolean | null) => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      roleOverride: null,
      isAuthenticated: false,
      isLoading: true,
      backendOnline: null,
      effectiveRole: () => {
        const s = get();
        return s.roleOverride || s.user?.role || null;
      },
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setRoleOverride: (roleOverride) => set({ roleOverride }),
      setLoading: (isLoading) => set({ isLoading }),
      setBackendOnline: (backendOnline) => set({ backendOnline }),
      hydrate: async () => {
        set({ isLoading: true });

        // Do not block auth hydration on health call; it can hang on flaky networks.
        try {
          const health = await navproApi.health();
          set({ backendOnline: health?.status === "ok" });
        } catch {
          set({ backendOnline: false });
        }

        const token =
          typeof window !== "undefined" ? localStorage.getItem("navpro_token") : null;
        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        try {
          const { user } = await navproApi.me();
          set({ user, isAuthenticated: true, isLoading: false, backendOnline: true });
        } catch {
          navproApi.setToken(null);
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
      logout: async () => {
        await navproApi.logout();
        set({ user: null, isAuthenticated: false, isLoading: false });
      },
    }),
    {
      name: "navpro-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        roleOverride: state.roleOverride,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrate();
      },
    }
  )
);
