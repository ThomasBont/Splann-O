import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string;
  profileImageUrl?: string;
  bio?: string;
  publicHandle?: string;
  publicProfileEnabled?: boolean;
  defaultEventType?: "private" | "public";
  preferredCurrencyCodes?: string[];
  defaultCurrencyCode?: string;
  favoriteCurrencyCodes?: string[];
  emailVerifiedAt?: string;
};

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'login_failed');
      return data as AuthUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
      try {
        sessionStorage.setItem('ortega_show_welcome', '1');
      } catch {
        // ignore
      }
    },
  });

  const register = useMutation({
    mutationFn: async ({ username, email, displayName, password }: { username: string; email: string; displayName?: string; password: string }) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, displayName, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'register_failed');
      return data as AuthUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
      try {
        sessionStorage.setItem('ortega_show_welcome', '1');
      } catch {
        // ignore
      }
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = '/';
    },
  });

  const forgotPassword = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'forgot_failed');
      return data;
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'reset_failed');
      return data;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: {
      displayName?: string;
      avatarUrl?: string | null;
      profileImageUrl?: string | null;
      bio?: string | null;
      publicHandle?: string | null;
      publicProfileEnabled?: boolean;
      defaultEventType?: "private" | "public";
      preferredCurrencyCodes?: string[] | null;
      defaultCurrencyCode?: string;
      favoriteCurrencyCodes?: string[];
    }) => {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'update_failed');
      return data as AuthUser;
    },
    onSuccess: (nextUser) => {
      queryClient.setQueryData(['/api/auth/me'], nextUser);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const resendVerification = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'resend_failed');
      return data as { sent: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/users/me', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'delete_failed');
      }
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  return {
    user: user ?? null,
    isLoading,
    login,
    register,
    logout,
    refresh,
    forgotPassword,
    resetPassword,
    resendVerification,
    updateProfile,
    deleteAccount,
  };
}
