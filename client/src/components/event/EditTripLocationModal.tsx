"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocationCombobox } from "@/components/location-combobox";
import type { LocationOption } from "@/lib/locations-data";
import { currencyForCountry } from "@/lib/locations-data";
import { getCurrencyLabelShort } from "@/lib/currencies";

export interface EditTripLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLocation: LocationOption | null;
  currentCurrency: string;
  currencySource: "auto" | "manual";
  onSave: (opts: {
    locationName: string;
    city: string;
    countryCode: string;
    countryName: string;
    latitude?: number | null;
    longitude?: number | null;
    /** When true, also update currency to the new country's currency */
    switchCurrency?: boolean;
    newCurrency?: string;
  }) => void;
  pending?: boolean;
}

export function EditTripLocationModal({
  open,
  onOpenChange,
  currentLocation,
  currentCurrency,
  currencySource,
  onSave,
  pending,
}: EditTripLocationModalProps) {
  const [location, setLocation] = useState<LocationOption | null>(currentLocation);
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<LocationOption | null>(null);

  useEffect(() => {
    if (open) {
      setLocation(currentLocation);
      setPendingLocation(null);
      setShowPrompt(false);
    }
  }, [open, currentLocation]);

  const handleSelectLocation = () => {
    if (!pendingLocation) return;
    const newCurrency = currencyForCountry(pendingLocation.countryCode);
    const needsPrompt =
      currencySource === "manual" &&
      currentCurrency !== newCurrency;

    if (needsPrompt) {
      setShowPrompt(true);
      return;
    }
    onSave({
      locationName: pendingLocation.locationName,
      city: pendingLocation.city,
      countryCode: pendingLocation.countryCode,
      countryName: pendingLocation.countryName,
      latitude: pendingLocation.lat ?? null,
      longitude: pendingLocation.lng ?? null,
    });
    setPendingLocation(null);
    onOpenChange(false);
  };

  const handleKeepManual = () => {
    if (!pendingLocation) return;
    onSave({
      locationName: pendingLocation.locationName,
      city: pendingLocation.city,
      countryCode: pendingLocation.countryCode,
      countryName: pendingLocation.countryName,
      latitude: pendingLocation.lat ?? null,
      longitude: pendingLocation.lng ?? null,
      switchCurrency: false,
    });
    setPendingLocation(null);
    setShowPrompt(false);
    onOpenChange(false);
  };

  const handleSwitchCurrency = () => {
    if (!pendingLocation) return;
    const curr = currencyForCountry(pendingLocation.countryCode);
    onSave({
      locationName: pendingLocation.locationName,
      city: pendingLocation.city,
      countryCode: pendingLocation.countryCode,
      countryName: pendingLocation.countryName,
      latitude: pendingLocation.lat ?? null,
      longitude: pendingLocation.lng ?? null,
      switchCurrency: true,
      newCurrency: curr,
    });
    setPendingLocation(null);
    setShowPrompt(false);
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setShowPrompt(false);
      setPendingLocation(null);
    }
    onOpenChange(next);
  };

  const newCurrency = pendingLocation ? currencyForCountry(pendingLocation.countryCode) : null;
  const newCurrencyLabel = newCurrency ? getCurrencyLabelShort(newCurrency) : null;

  return (
    <Modal
      open={open}
      onClose={() => handleOpenChange(false)}
      onOpenChange={handleOpenChange}
      title={showPrompt ? "Keep or switch currency?" : "Edit location"}
      subtitle={
        showPrompt
          ? `This trip uses manual currency. The new location uses ${newCurrencyLabel}.`
          : undefined
      }
      size="md"
      footer={
        showPrompt ? (
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={handleKeepManual} disabled={pending}>
              Keep {getCurrencyLabelShort(currentCurrency)}
            </Button>
            <Button onClick={handleSwitchCurrency} disabled={pending}>
              Switch to {newCurrencyLabel}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSelectLocation}
              disabled={!pendingLocation || pending}
            >
              Save
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {!showPrompt ? (
          <>
            <div className="space-y-2">
              <Label>Location</Label>
              <LocationCombobox
                value={location}
                onChange={(loc) => {
                  setLocation(loc);
                  setPendingLocation(loc);
                }}
                placeholder="Search city or country…"
              />
            </div>
            {pendingLocation && (
              <p className="text-xs text-muted-foreground">
                New currency: {getCurrencyLabelShort(currencyForCountry(pendingLocation.countryCode))}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Keep manual currency ({getCurrencyLabelShort(currentCurrency)}) or switch to{" "}
            {newCurrencyLabel} ({pendingLocation?.countryName})?
          </p>
        )}
      </div>
    </Modal>
  );
}
