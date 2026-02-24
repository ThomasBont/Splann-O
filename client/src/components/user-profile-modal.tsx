"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/hooks/use-language";
import {
  useFriends,
  useFriendRequests,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRemoveFriend,
  useSearchUsers,
} from "@/hooks/use-friends";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  UserCircle,
  Search,
  UserPlus,
  UserX,
  UserCheck,
  Loader2,
  Edit2,
  Trash2,
  Settings2,
  CalendarDays,
  Heart,
  Receipt,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FriendInfo } from "@shared/schema";

function getInitials(displayName: string | null, username: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

function avatarColor(id: number): string {
  const hues = ["#e05c2a", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
  return hues[id % hues.length];
}

export interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Username to view. Null = current user (editable). */
  username?: string | null;
  /** When user clicks another profile (e.g. friend), switch to viewing that user. */
  onViewUser?: (username: string) => void;
}

export function UserProfileModal({ open, onOpenChange, username: usernameProp, onViewUser }: UserProfileModalProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user: authUser, updateProfile, deleteAccount } = useAuth();
  const isOwnProfile = !usernameProp || usernameProp === authUser?.username;
  const effectiveUsername = usernameProp ?? authUser?.username ?? null;

  const { data: profileData, isLoading: profileLoading } = useUserProfile(effectiveUsername);
  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: friendRequests = [], isLoading: requestsLoading } = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();

  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftProfileImageUrl, setDraftProfileImageUrl] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState("");

  const { data: searchResults = [], isLoading: searchLoading } = useSearchUsers(searchQuery);

  const displayUser = isOwnProfile ? authUser : profileData?.user;
  const stats = profileData?.stats ?? { eventsCount: 0, friendsCount: 0, totalSpent: 0 };

  useEffect(() => {
    if (authUser && isOwnProfile) {
      setDraftDisplayName(authUser.displayName || "");
      setDraftBio(authUser.bio || "");
      setDraftProfileImageUrl(authUser.profileImageUrl || authUser.avatarUrl || "");
    }
  }, [authUser, isOwnProfile]);

  useEffect(() => { setEditMode(false); }, [effectiveUsername]);

  const friendUserIds = new Set(friends.map((f: FriendInfo) => f.userId));
  const requestUserIds = new Set(friendRequests.map((f: FriendInfo) => f.userId));
  const filteredResults = searchResults.filter(
    (u: { id: number }) => u.id !== authUser?.id && !friendUserIds.has(u.id) && !requestUserIds.has(u.id)
  );

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      onOpenChange={onOpenChange}
      size="lg"
      scrollable
      className="sm:max-w-md bg-card border-border"
      data-testid="dialog-user-profile"
    >
      {profileLoading && !displayUser ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{t.auth.profile}</p>
          </div>
        ) : displayUser ? (
          <Tabs defaultValue="profile" className="mt-1">
            <TabsList className="w-full bg-secondary/30 border border-white/5 mb-4">
              <TabsTrigger value="profile" className="flex-1" data-testid="tab-profile">
                {t.profileTabs.profile}
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex-1" data-testid="tab-friends">
                {t.profileTabs.friends}
                {isOwnProfile && friendRequests.length > 0 && (
                  <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center">
                    {friendRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1" data-testid="tab-activity">
                {t.profileTabs.activity}
              </TabsTrigger>
              {isOwnProfile && (
                <TabsTrigger value="settings" className="flex-1" data-testid="tab-settings">
                  {t.profileTabs.settings}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="profile" className="mt-0 space-y-4">
              <div className="flex flex-col items-center">
                <div
                  className="relative w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0 overflow-hidden ring-4 ring-white/10"
                  style={{
                    background: displayUser ? avatarColor(displayUser.id) : "#666",
                    boxShadow: "0 0 0 3px hsl(var(--border)), 0 0 20px -5px " + (displayUser ? avatarColor(displayUser.id) : "#666"),
                  }}
                >
                  {displayUser?.profileImageUrl || (displayUser as any)?.avatarUrl ? (
                    <img src={displayUser.profileImageUrl || (displayUser as any).avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    displayUser ? getInitials(displayUser.displayName, displayUser.username) : <UserCircle className="w-12 h-12" />
                  )}
                </div>
                <div className="mt-4 text-center space-y-1">
                  <p className="text-xl font-bold font-display" data-testid="text-profile-displayname">
                    {displayUser?.displayName || displayUser?.username}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-profile-username">
                    @{displayUser?.username}
                  </p>
                  {isOwnProfile && authUser?.email && (
                    <p className="text-xs text-muted-foreground" data-testid="text-profile-email">{authUser.email}</p>
                  )}
                  {!editMode && displayUser?.bio && (
                    <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">{displayUser.bio}</p>
                  )}
                </div>

                <div className="w-full grid grid-cols-3 gap-3 mt-6">
                  <div className="rounded-xl border border-white/10 bg-secondary/20 p-3 text-center">
                    <CalendarDays className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold text-primary">{stats.eventsCount}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.profileStats.events}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-secondary/20 p-3 text-center">
                    <Heart className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold text-primary">{stats.friendsCount}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.profileStats.friends}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-secondary/20 p-3 text-center">
                    <Receipt className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold text-primary">{stats.totalSpent.toFixed(0)}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.profileStats.totalSpent}</p>
                  </div>
                </div>

                {isOwnProfile && (
                  <>
                    {!editMode ? (
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditMode(true)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        {t.auth.editProfile}
                      </Button>
                    ) : (
                      <div className="w-full mt-6 space-y-4 rounded-xl border border-white/10 bg-secondary/10 p-4">
                        <div>
                          <Label className="text-xs">{t.auth.displayName}</Label>
                          <Input
                            value={draftDisplayName}
                            onChange={(e) => setDraftDisplayName(e.target.value)}
                            placeholder={t.auth.displayNamePlaceholder}
                            className="mt-1 bg-secondary/50 border-white/10"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t.auth.profilePictureUrl}</Label>
                          <Input
                            value={draftProfileImageUrl}
                            onChange={(e) => setDraftProfileImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="mt-1 bg-secondary/50 border-white/10"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t.auth.bio}</Label>
                          <textarea
                            value={draftBio}
                            onChange={(e) => setDraftBio(e.target.value)}
                            placeholder={t.auth.bio}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-secondary/50 border-white/10 px-3 py-2 text-sm mt-1 resize-none"
                            maxLength={500}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              updateProfile.mutate(
                                {
                                  displayName: draftDisplayName || undefined,
                                  profileImageUrl: draftProfileImageUrl || null,
                                  bio: draftBio || null,
                                },
                                {
                                  onSuccess: () => {
                                    toast({ variant: "success", message: t.modals.profileSaved });
                                    setEditMode(false);
                                  },
                                }
                              );
                            }}
                            disabled={updateProfile.isPending}
                          >
                            {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.modals.save}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                            {t.modals.cancel}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {isOwnProfile && !editMode && (
                <div className="rounded-xl border border-white/10 bg-secondary/10 p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.user.deleteAccount}</p>
                  <p className="text-xs text-muted-foreground">{t.user.deleteAccountConfirm} {t.user.cannotBeUndone}</p>
                  {!deleteConfirmOpen ? (
                    <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                      <Trash2 className="w-4 h-4 mr-1" /> {t.user.deleteAccount}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs">{t.user.typeUsernameToConfirm}</Label>
                      <Input
                        value={deleteConfirmUsername}
                        onChange={(e) => setDeleteConfirmUsername(e.target.value)}
                        placeholder={authUser?.username}
                        className="font-mono bg-secondary/50"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleteConfirmUsername !== authUser?.username || deleteAccount.isPending}
                          onClick={() => deleteAccount.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
                        >
                          {deleteAccount.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.user.deleteAccount}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmUsername(""); }}>
                          {t.modals.cancel}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="friends" className="mt-0 space-y-4">
              {isOwnProfile ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder={t.friends.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-secondary/50 border-white/10"
                    />
                  </div>
                  <AnimatePresence mode="wait">
                    {searchQuery.length >= 2 && (
                      <motion.div key="search-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t.friends.addFriend}</p>
                        {searchLoading ? (
                          <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                        ) : filteredResults.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">{t.friends.userNotFound}</p>
                        ) : (
                          filteredResults.map((u: { id: number; username: string; displayName?: string }) => (
                            <div
                              key={u.id}
                              className="flex items-center justify-between gap-2 bg-secondary/20 border border-white/5 rounded-xl px-3 py-2"
                              data-testid={`search-result-${u.id}`}
                            >
                              <button
                                type="button"
                                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80"
                                onClick={() => onViewUser?.(u.username)}
                              >
                                <UserCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{u.displayName || u.username}</p>
                                  <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                                </div>
                              </button>
                              <Button size="sm" variant="ghost" onClick={() => sendRequest.mutate(u.username)} disabled={sendRequest.isPending}>
                                {sendRequest.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {friendRequests.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t.friends.friendRequests} ({friendRequests.length})</p>
                      {requestsLoading ? (
                        <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                      ) : (
                        friendRequests.map((req: FriendInfo) => (
                          <div key={req.friendshipId} className="flex items-center justify-between gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                            <button
                              type="button"
                              className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80"
                              onClick={() => onViewUser?.(req.username)}
                            >
                              <UserCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{req.displayName || req.username}</p>
                                <p className="text-[11px] text-muted-foreground">@{req.username}</p>
                              </div>
                            </button>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => acceptRequest.mutate(req.friendshipId)} disabled={acceptRequest.isPending}>
                                <UserCheck className="w-4 h-4 text-green-400" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => removeFriend.mutate(req.friendshipId)} disabled={removeFriend.isPending}>
                                <UserX className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t.friends.title} ({friends.length})</p>
                    {friendsLoading ? (
                      <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : friends.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">{t.friends.noFriends}</p>
                    ) : (
                      friends.map((friend: FriendInfo) => (
                        <div key={friend.friendshipId} className="flex items-center justify-between gap-2 bg-secondary/20 border border-white/5 rounded-xl px-3 py-2">
                          <button
                            type="button"
                            className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80"
                            onClick={() => onViewUser?.(friend.username)}
                          >
                            <UserCircle className="w-4 h-4 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{friend.displayName || friend.username}</p>
                              <p className="text-[11px] text-muted-foreground">@{friend.username}</p>
                            </div>
                          </button>
                          <Button size="icon" variant="ghost" onClick={() => removeFriend.mutate(friend.friendshipId)} disabled={removeFriend.isPending}>
                            <UserX className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{t.profileStats.friends}: {stats.friendsCount}</p>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <div className="rounded-xl border border-white/10 bg-secondary/10 p-8 text-center">
                <p className="text-sm text-muted-foreground">{t.profileActivity.comingSoon}</p>
              </div>
            </TabsContent>

            {isOwnProfile && (
              <TabsContent value="settings" className="mt-0 space-y-4">
                <div className="rounded-xl border border-white/10 bg-secondary/10 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    {t.user.preferredCurrencies}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CURRENCIES.map((cur) => {
                      const checked = authUser?.preferredCurrencyCodes?.length ? authUser.preferredCurrencyCodes.includes(cur.code) : true;
                      return (
                        <label key={cur.code} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(checkedVal) => {
                              const next = authUser?.preferredCurrencyCodes?.length ? [...authUser.preferredCurrencyCodes] : CURRENCIES.map((c) => c.code);
                              const newList = checkedVal ? (next.includes(cur.code) ? next : [...next, cur.code]) : next.filter((c) => c !== cur.code);
                              updateProfile.mutate({ preferredCurrencyCodes: newList.length === CURRENCIES.length ? null : newList });
                            }}
                          />
                          <span className="text-sm">{cur.code}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {!authUser?.preferredCurrencyCodes?.length ? "All currencies shown by default." : "Currencies to display in events."}
                  </p>
                </div>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{t.friends.userNotFound}</p>
          </div>
        )}
    </Modal>
  );
}
