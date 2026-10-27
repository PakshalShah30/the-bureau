"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({ className, ...props }, ref) =>
  <TabsPrimitive.List ref={ref} className={cn("flex gap-1 rounded-xl bg-muted p-1", className)} {...props} />);
TabsList.displayName = TabsPrimitive.List.displayName;
export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({ className, ...props }, ref) =>
  <TabsPrimitive.Trigger ref={ref} className={cn("flex-1 rounded-lg py-2 text-xs font-bold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm", className)} {...props} />);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;
export const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({ className, ...props }, ref) =>
  <TabsPrimitive.Content ref={ref} className={cn("focus-visible:outline-none", className)} {...props} />);
TabsContent.displayName = TabsPrimitive.Content.displayName;
