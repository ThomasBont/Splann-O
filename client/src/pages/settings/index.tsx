"use client";

import * as React from "react";
import { useLocation } from "wouter";
import { Loader2, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";
import AccountSettingsContent from "@/components/account/AccountSettingsContent";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const pushNotifications = usePushNotifications();

  React.useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    );
  }

  const pushStatusLabel = !pushNotifications.isSupported
    ? "Not supported on this device"
    : pushNotifications.isSubscribed
      ? "On"
      : pushNotifications.permission === "denied"
        ? "Blocked in browser settings"
        : "Off";

  const handlePushToggle = async (checked: boolean) => {
    try {
      if (checked) {
        await pushNotifications.subscribe();
        toast({ variant: "success", message: "Push notifications enabled" });
      } else {
        await pushNotifications.unsubscribe();
        toast({ variant: "success", message: "Push notifications disabled" });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: error instanceof Error ? error.message : "Unable to update notifications.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
          <Button variant="outline" onClick={() => setLocation("/app")}>
            Back to app
          </Button>
        </div>

        <div className="space-y-6">
          <AccountSettingsContent />

          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="text-lg">Notifications</CardTitle>
                <CardDescription>
                  Receive a notification when there is a new expense or payment request.
                </CardDescription>
                <p className="text-sm text-muted-foreground">Status: {pushStatusLabel}</p>
              </div>
              <div className="flex items-center gap-3">
                {pushNotifications.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                <Switch
                  checked={pushNotifications.isSubscribed}
                  onCheckedChange={handlePushToggle}
                  disabled={!pushNotifications.isSupported || pushNotifications.isLoading}
                  aria-label="Toggle push notifications"
                />
              </div>
            </CardHeader>
          </Card>

          <Card className="opacity-80">
            <CardHeader>
              <CardTitle className="text-lg">Profile</CardTitle>
              <CardDescription>Placeholder section for future account/profile settings.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
