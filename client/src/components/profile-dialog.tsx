import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import {
  useFriends, useFriendRequests, useSendFriendRequest,
  useAcceptFriendRequest, useRemoveFriend, useSearchUsers,
} from "@/hooks/use-friends";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCircle, Search, UserPlus, UserX, UserCheck, Loader2, Heart, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FriendInfo } from "@shared/schema";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: friendRequests = [], isLoading: requestsLoading } = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();

  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults = [], isLoading: searchLoading } = useSearchUsers(searchQuery);

  const friendUserIds = new Set(friends.map((f: FriendInfo) => f.userId));
  const requestUserIds = new Set(friendRequests.map((f: FriendInfo) => f.userId));
  const filteredResults = searchResults.filter(
    (u: any) => u.id !== user?.id && !friendUserIds.has(u.id) && !requestUserIds.has(u.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" data-testid="dialog-profile">
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

          <TabsContent value="profile" className="mt-4">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <UserCircle className="w-10 h-10 text-primary" />
              </div>
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
              </div>
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
      </DialogContent>
    </Dialog>
  );
}
