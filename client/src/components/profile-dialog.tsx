import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/hooks/use-language";
import {
  useFriends, useFriendRequests, useSendFriendRequest,
  useAcceptFriendRequest, useRemoveFriend, useSearchUsers,
} from "@/hooks/use-friends";
import {
  Dialog, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DraggableDialogContent } from "@/components/ui/draggable-dialog-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { UserCircle, Search, UserPlus, UserX, UserCheck, Loader2, Heart, X, Trash2 } from "lucide-react";
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

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { t } = useLanguage();
  const { user, updateProfile, deleteAccount } = useAuth();
  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: friendRequests = [], isLoading: requestsLoading } = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();

  const [searchQuery, setSearchQuery] = useState("");
  const [editProfile, setEditProfile] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftProfileImageUrl, setDraftProfileImageUrl] = useState("");
  const [draftCurrencies, setDraftCurrencies] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState("");

  const { data: searchResults = [], isLoading: searchLoading } = useSearchUsers(searchQuery);

  useEffect(() => {
    if (user) {
      setDraftDisplayName(user.displayName || "");
      setDraftBio(user.bio || "");
      setDraftProfileImageUrl(user.profileImageUrl || "");
      setDraftCurrencies(user.preferredCurrencyCodes?.length ? [...user.preferredCurrencyCodes] : CURRENCIES.map(c => c.code));
    }
  }, [user]);

  const friendUserIds = new Set(friends.map((f: FriendInfo) => f.userId));
  const requestUserIds = new Set(friendRequests.map((f: FriendInfo) => f.userId));
  const filteredResults = searchResults.filter(
    (u: any) => u.id !== user?.id && !friendUserIds.has(u.id) && !requestUserIds.has(u.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" data-testid="dialog-profile">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            {t.friends.profile}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-1">
          <TabsList className="w-full bg-secondary/30 border border-white/5">
            <TabsTrigger value="profile" className="flex-1" data-testid="tab-profile">
              {t.auth.profile}
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex-1" data-testid="tab-friends">
              {t.friends.title}
              {friendRequests.length > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center">
                  {friendRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0 overflow-hidden"
                style={{ background: user ? avatarColor(user.id) : "#666" }}
              >
                {user?.profileImageUrl || user?.avatarUrl ? (
                  <img src={user.profileImageUrl || user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  user ? getInitials(user.displayName, user.username) : <UserCircle className="w-10 h-10" />
                )}
              </div>
              {!editProfile ? (
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold" data-testid="text-profile-displayname">
                    {user?.displayName || user?.username}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-profile-username">
                    @{user?.username}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-profile-email">
                    {user?.email}
                  </p>
                  {user?.bio ? <p className="text-sm text-muted-foreground mt-2 max-w-xs">{user.bio}</p> : null}
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditProfile(true)}>
                    {t.auth.editProfile}
                  </Button>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  <div>
                    <Label className="text-xs">{t.auth.displayName}</Label>
                    <Input
                      value={draftDisplayName}
                      onChange={e => setDraftDisplayName(e.target.value)}
                      placeholder={t.auth.displayNamePlaceholder}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t.auth.profilePictureUrl}</Label>
                    <Input
                      value={draftProfileImageUrl}
                      onChange={e => setDraftProfileImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t.auth.bio}</Label>
                    <textarea
                      value={draftBio}
                      onChange={e => setDraftBio(e.target.value)}
                      placeholder={t.auth.bio}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
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
                            preferredCurrencyCodes: draftCurrencies.length === CURRENCIES.length ? null : draftCurrencies,
                          },
                          { onSuccess: () => setEditProfile(false) }
                        );
                      }}
                      disabled={updateProfile.isPending}
                    >
                      {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.modals.save}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditProfile(false)}>
                      {t.modals.cancel}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{t.user.preferredCurrencies}</p>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map(cur => {
                  const checked = editProfile
                    ? draftCurrencies.includes(cur.code)
                    : (user?.preferredCurrencyCodes?.length ? user.preferredCurrencyCodes.includes(cur.code) : true);
                  return (
                    <label key={cur.code} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={checkedVal => {
                          if (editProfile) {
                            setDraftCurrencies(prev =>
                              checkedVal ? [...prev, cur.code] : prev.filter(c => c !== cur.code)
                            );
                          } else {
                            const next = user?.preferredCurrencyCodes?.length ? [...user.preferredCurrencyCodes] : CURRENCIES.map(c => c.code);
                            const newList = checkedVal ? (next.includes(cur.code) ? next : [...next, cur.code]) : next.filter(c => c !== cur.code);
                            updateProfile.mutate({ preferredCurrencyCodes: newList.length === CURRENCIES.length ? null : newList });
                          }
                        }}
                      />
                      <span className="text-sm">{cur.code}</span>
                    </label>
                  );
                })}
              </div>
              {editProfile && <p className="text-[11px] text-muted-foreground mt-1">Save profile to apply currency selection.</p>}
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t.user.deleteAccount}</p>
              <p className="text-xs text-muted-foreground mb-2">{t.user.deleteAccountConfirm} {t.user.cannotBeUndone}</p>
              {!deleteConfirmOpen ? (
                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-1" /> {t.user.deleteAccount}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">{t.user.typeUsernameToConfirm}</Label>
                  <Input
                    value={deleteConfirmUsername}
                    onChange={e => setDeleteConfirmUsername(e.target.value)}
                    placeholder={user?.username}
                    className="font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteConfirmUsername !== user?.username || deleteAccount.isPending}
                      onClick={() => {
                        deleteAccount.mutate(undefined, { onSuccess: () => onOpenChange(false) });
                      }}
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
          </TabsContent>

          <TabsContent value="friends" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t.friends.searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-friends"
              />
            </div>

            <AnimatePresence mode="wait">
              {searchQuery.length >= 2 && (
                <motion.div
                  key="search-results"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1"
                >
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">
                    {t.friends.addFriend}
                  </p>
                  {searchLoading ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">{t.friends.userNotFound}</p>
                  ) : (
                    filteredResults.map((u: any) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-2 bg-secondary/20 border border-white/5 rounded-xl px-3 py-2"
                        data-testid={`search-result-${u.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <UserCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.displayName || u.username}</p>
                            <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => sendRequest.mutate(u.username)}
                          disabled={sendRequest.isPending}
                          data-testid={`button-add-friend-${u.id}`}
                        >
                          {sendRequest.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {friendRequests.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">
                  {t.friends.friendRequests} ({friendRequests.length})
                </p>
                {requestsLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  friendRequests.map((req: FriendInfo) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2"
                      data-testid={`friend-request-${req.friendshipId}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{req.displayName || req.username}</p>
                          <p className="text-[11px] text-muted-foreground">@{req.username}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => acceptRequest.mutate(req.friendshipId)}
                          disabled={acceptRequest.isPending}
                          data-testid={`button-accept-request-${req.friendshipId}`}
                        >
                          <UserCheck className="w-4 h-4 text-green-400" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFriend.mutate(req.friendshipId)}
                          disabled={removeFriend.isPending}
                          data-testid={`button-decline-request-${req.friendshipId}`}
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">
                {t.friends.title} ({friends.length})
              </p>
              {friendsLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : friends.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t.friends.noFriends}</p>
              ) : (
                friends.map((friend: FriendInfo) => (
                  <div
                    key={friend.friendshipId}
                    className="flex items-center justify-between gap-2 bg-secondary/20 border border-white/5 rounded-xl px-3 py-2"
                    data-testid={`friend-item-${friend.friendshipId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{friend.displayName || friend.username}</p>
                        <p className="text-[11px] text-muted-foreground">@{friend.username}</p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFriend.mutate(friend.friendshipId)}
                      disabled={removeFriend.isPending}
                      data-testid={`button-remove-friend-${friend.friendshipId}`}
                    >
                      <UserX className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DraggableDialogContent>
    </Dialog>
  );
}
