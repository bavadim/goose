// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Sidebar,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type ButtonProps,
  type InputProps,
} from "../src/desktop/renderer/ui/components/index.js";

describe("MUST keep core ui kit exports consumable", () => {
  it("MUST provide consumable primitives from the public barrel", () => {
    const buttonProps: ButtonProps = { children: "trigger" };
    const inputProps: InputProps = { value: "value", readOnly: true };

    render(
      <div>
        <Dialog defaultOpen>
          <DialogTrigger>{buttonProps.children}</DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
            </DialogHeader>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>

        <DropdownMenu open>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Sheet defaultOpen>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet title</SheetTitle>
              <SheetDescription>Sheet description</SheetDescription>
            </SheetHeader>
            Sheet content
          </SheetContent>
        </Sheet>

        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Tab A</TabsTrigger>
            <TabsTrigger value="b">Tab B</TabsTrigger>
          </TabsList>
          <TabsContent value="a">A content</TabsContent>
          <TabsContent value="b">B content</TabsContent>
        </Tabs>

        <TooltipProvider>
          <Tooltip defaultOpen>
            <TooltipTrigger asChild>
              <button type="button">Hover me</button>
            </TooltipTrigger>
            <TooltipContent>Tip</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Sidebar>Sidebar content</Sidebar>
        <ScrollArea className="h-10 w-10">Scrollable</ScrollArea>
        <Skeleton data-testid="skeleton" className="h-4 w-4" />
        <input {...inputProps} aria-label="input" />
      </div>,
    );

    expect(screen.getByText("Dialog")).toBeVisible();
    expect(screen.getByText("Sheet content")).toBeVisible();
    expect(screen.getByText("Sidebar content")).toBeVisible();
    expect(screen.getByTestId("skeleton")).toBeVisible();
    expect(screen.getByLabelText("input")).toHaveValue("value");
  });
});
