import { useQuery } from "@tanstack/react-query";

export type PublicProfile = {
  user: {
    id: number;
    username: string;
    displayName: string | null;
    profileImageUrl?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
  };
  stats: {
    eventsCount: number;
    friendsCount: number;
    totalSpent: number;
  };
};

export function useUserProfile(username: string | null) {
  return useQuery<PublicProfile | null>({
    queryKey: ["/api/users", username],
    queryFn: async () => {
      if (!username) return null;
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch profile");
      }
      return res.json();
    },
    enabled: !!username,
  });
}
