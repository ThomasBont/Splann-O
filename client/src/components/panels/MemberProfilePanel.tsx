import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { useUserProfile } from "@/hooks/use-user-profile";
import { usePlanCrew } from "@/hooks/use-plan-data";
import { resolveAssetUrl } from "@/lib/asset-url";

function initials(value: string) {
  const safe = value.trim();
  if (!safe) return "U";
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return safe.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function formatJoined(value?: string | null) {
  if (!value) return "Joined recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Joined recently";
  return `Joined ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export function MemberProfilePanel({ username }: { username: string }) {
  const eventId = useActiveEventId();
  const crewQuery = usePlanCrew(eventId);
  const profileQuery = useUserProfile(username);
  const member = (crewQuery.data?.members ?? []).find((entry) => entry.username === username) ?? null;
  const profile = profileQuery.data?.user ?? null;
  const profileName = profile?.displayName || member?.name || username;
  const avatarUrl = profile?.profileImageUrl || profile?.avatarUrl || member?.avatarUrl || null;

  return (
    <PanelShell>
      <PanelHeader
        label="Profile"
        title={profileName}
        meta={(
          <>
            <span className="truncate">@{profile?.username || username}</span>
            {member ? <span>{member.role === "owner" ? "Owner" : "Member"} · {formatJoined(member.joinedAt)}</span> : null}
          </>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {profileQuery.isLoading ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            Loading profile...
          </div>
        ) : profileQuery.isError || !profile ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Could not load this profile.
          </div>
        ) : (
          <>
            <PanelSection title="Member" variant="list">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {avatarUrl ? <AvatarImage src={resolveAssetUrl(avatarUrl) ?? avatarUrl} alt={profileName} /> : null}
                  <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                    {initials(profileName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{profileName}</p>
                  <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
                  {member ? (
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {member.role === "owner" ? "Owner" : "Member"} · {formatJoined(member.joinedAt)}
                    </p>
                  ) : null}
                </div>
              </div>
            </PanelSection>

            <PanelSection title="About" variant="list">
              <p className="text-sm leading-6 text-foreground/90">
                {profile.bio?.trim() ? profile.bio : "No bio yet."}
              </p>
            </PanelSection>

            <PanelSection title="Snapshot" variant="list">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Plans</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{profileQuery.data?.stats.eventsCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Friends</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{profileQuery.data?.stats.friendsCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Spent</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">€ {Number(profileQuery.data?.stats.totalSpent ?? 0).toFixed(0)}</p>
                </div>
              </div>
            </PanelSection>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default MemberProfilePanel;
