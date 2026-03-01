import type * as DialogPrimitive from "@radix-ui/react-dialog";
import type * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import type { ButtonProps, InputProps } from "../ui/components/index.js";

export type ButtonContract = ButtonProps;
export type InputContract = InputProps;

export type CardContract = HTMLAttributes<HTMLDivElement>;
export type CardHeaderContract = HTMLAttributes<HTMLDivElement>;
export type CardTitleContract = HTMLAttributes<HTMLHeadingElement>;
export type CardContentContract = HTMLAttributes<HTMLDivElement>;

export type DialogContentContract = ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
>;
export type DialogHeaderContract = ComponentPropsWithoutRef<"div">;
export type DialogTitleContract = ComponentPropsWithoutRef<
  typeof DialogPrimitive.Title
>;

export type DropdownMenuContentContract = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;
export type DropdownMenuItemContract = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
>;

export type ScrollAreaContract = ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
>;
export type SheetContentContract = ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
>;
export type SheetHeaderContract = ComponentPropsWithoutRef<"div">;
export type SidebarContract = HTMLAttributes<HTMLElement>;
export type SkeletonContract = HTMLAttributes<HTMLDivElement>;
export type SwitchContract = ComponentPropsWithoutRef<
  typeof SwitchPrimitive.Root
>;

export type TabsListContract = ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
>;
export type TabsTriggerContract = ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
>;
export type TabsContentContract = ComponentPropsWithoutRef<
  typeof TabsPrimitive.Content
>;

export type TooltipContentContract = ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
>;
