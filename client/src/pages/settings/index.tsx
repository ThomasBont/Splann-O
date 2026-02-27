"use client";

import * as React from "react";
import { useLocation } from "wouter";
import { Check, Loader2, Plus, Settings, Star, User, Bell, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CurrencyPicker } from "@/components/currency-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { AllCurrencies, getCurrency, getCurrencyLabelShort, findCurrency } from "@/lib/currencies";

const MAX_FAVORITES = 10;

type NavKey = "profile" | "currency" | "notifications";

function FavoritesCurrencyPicker({
  value,
  onChange,
  max = MAX_FAVORITES,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
  max?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedSet = React.useMemo(() => new Set(value), [value]);
  const results = React.useMemo(() => {
    const base = search.trim() ? findCurrency(search) : AllCurrencies;
    return base.filter((c) => !selectedSet.has(c.code)).slice(0, 50);
  }, [search, selectedSet]);

  const addCode = (code: string) => {
    if (selectedSet.has(code) || value.length >= max) return;
    onChange([...value, code]);
    setSearch("");
  };

  const removeCode = (code: string) => {
    onChange(value.filter((c) => c !== code));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-9">
        {value.map((code) => {
          const currency = getCurrency(code);
          return (
            <Badge
              key={code}
              variant="secondary"
              className="gap-1.5 pr-1"
            >
              <span>{currency ? getCurrencyLabelShort(currency) : code}</span>
              <button
                type="button"
                className="rounded p-0.5 hover:bg-background/70"
                onClick={() => removeCode(code)}
                aria-label={`Remove ${code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        {value.length === 0 && (
          <p className="text-sm text-muted-foreground">No favorites yet.</p>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            disabled={value.length >= max}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add favorite currency
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[320px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search code, name, symbol..."
            />
            <CommandList>
              <CommandEmpty>No currency found</CommandEmpty>
              <CommandGroup heading="Currencies">
                {results.map((cur) => (
                  <CommandItem
                    key={cur.code}
                    value={cur.code}
                    onSelect={() => {
                      addCode(cur.code);
                      if (value.length + 1 >= max) setOpen(false);
                    }}
                    className="min-h-[40px]"
                  >
                    <span className="font-medium tabular-nums">{getCurrencyLabelShort(cur)}</span>
                    <span className="text-xs text-muted-foreground truncate">{cur.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        {value.length >= max
          ? `Maximum ${max} favorites reached. Remove one to add another.`
          : `Pick up to ${max} favorites for quick access in currency pickers.`}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, updateProfile } = useAuth();
  const { toast } = useToast();
  const [activeNav] = React.useState<NavKey>("currency");
  const [defaultCurrencyCode, setDefaultCurrencyCode] = React.useState("EUR");
  const [favoriteCurrencyCodes, setFavoriteCurrencyCodes] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  React.useEffect(() => {
    if (!user) return;
    setDefaultCurrencyCode(user.defaultCurrencyCode || "EUR");
    setFavoriteCurrencyCodes((user.favoriteCurrencyCodes ?? []).slice(0, MAX_FAVORITES));
  }, [user?.id, user?.defaultCurrencyCode, user?.favoriteCurrencyCodes]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const normalizedFavorites = Array.from(new Set(favoriteCurrencyCodes)).slice(0, MAX_FAVORITES);
  const hasChanges =
    (user.defaultCurrencyCode || "EUR") !== defaultCurrencyCode ||
    JSON.stringify(user.favoriteCurrencyCodes ?? []) !== JSON.stringify(normalizedFavorites);

  const saveSettings = async () => {
    try {
      await updateProfile.mutateAsync({
        defaultCurrencyCode: defaultCurrencyCode.toUpperCase(),
        favoriteCurrencyCodes: normalizedFavorites,
      });
      toast({ title: "Saved", variant: "success" });
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save", variant: "destructive" });
    }
  };

  const navItems: Array<{ key: NavKey; label: string; icon: React.ComponentType<{ className?: string }>; placeholder?: string }> = [
    { key: "profile", label: "Profile", icon: User, placeholder: "Profile settings coming soon" },
    { key: "currency", label: "Currency", icon: Star },
    { key: "notifications", label: "Notifications", icon: Bell, placeholder: "Notification settings coming soon" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
          <Button variant="outline" onClick={() => setLocation("/app")}>
            Back to app
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-xl border bg-card p-2 h-fit">
            <nav className="space-y-1" aria-label="Settings navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.key === activeNav;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={[
                      "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                    ].join(" ")}
                    disabled={!active}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {!active && <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Currency</CardTitle>
                <CardDescription>
                  Configure your default currency and pin favorites for quick access across events and trips.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default currency</label>
                  <p className="text-xs text-muted-foreground">
                    Used when creating a new event without a selected country.
                  </p>
                  <CurrencyPicker
                    value={defaultCurrencyCode}
                    onChange={setDefaultCurrencyCode}
                    profileFavorites={user.favoriteCurrencyCodes ?? []}
                    recentStorageUserKey={`user-${user.id}`}
                    triggerClassName="w-full justify-between"
                    className="w-[min(520px,calc(100vw-3rem))]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Favorite currencies</label>
                  <p className="text-xs text-muted-foreground">
                    Favorites appear first in currency pickers throughout the app.
                  </p>
                  <FavoritesCurrencyPicker
                    value={normalizedFavorites}
                    onChange={(codes) => setFavoriteCurrencyCodes(Array.from(new Set(codes)).slice(0, MAX_FAVORITES))}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Changes apply to all currency pickers immediately after saving.
                  </p>
                  <Button onClick={saveSettings} disabled={!hasChanges || updateProfile.isPending}>
                    {updateProfile.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="opacity-80">
              <CardHeader>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>Placeholder section for future account/profile settings.</CardDescription>
              </CardHeader>
              {user && (
                <CardContent className="pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/u/${encodeURIComponent(user.publicHandle || user.username)}`, "_blank")}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Open public profile
                  </Button>
                </CardContent>
              )}
            </Card>

            <Card className="opacity-80">
              <CardHeader>
                <CardTitle className="text-lg">Notifications</CardTitle>
                <CardDescription>Placeholder section for future notification preferences.</CardDescription>
              </CardHeader>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
