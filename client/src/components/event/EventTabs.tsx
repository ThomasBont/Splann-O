"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { FOCUS_RING } from "@/lib/ui-utils";

const EventTabs = TabsPrimitive.Root;

const EventTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex w-full items-center justify-start gap-4 border-b border-[hsl(var(--border-subtle))] bg-transparent px-0 pb-0 pt-0 text-muted-foreground",
      "overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className
    )}
    {...props}
  />
));
EventTabsList.displayName = "EventTabsList";

const EventTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-sm font-medium",
      "text-muted-foreground transition-all duration-200 ease-out",
      FOCUS_RING,
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none",
      "hover:text-foreground/80",
      className
    )}
    {...props}
  />
));
EventTabsTrigger.displayName = "EventTabsTrigger";

const EventTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 min-h-[280px] focus-visible:outline-none", className)}
    {...props}
  />
));
EventTabsContent.displayName = "EventTabsContent";

export { EventTabs, EventTabsList, EventTabsTrigger, EventTabsContent };
