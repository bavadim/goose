// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type {
  ButtonContract,
  CardContentContract,
  CardContract,
  CardHeaderContract,
  CardTitleContract,
  DialogContentContract,
  DialogHeaderContract,
  DialogTitleContract,
  DropdownMenuContentContract,
  DropdownMenuItemContract,
  InputContract,
  ScrollAreaContract,
  SheetContentContract,
  SheetHeaderContract,
  SidebarContract,
  SkeletonContract,
  SwitchContract,
  TabsContentContract,
  TabsListContract,
  TabsTriggerContract,
  TooltipContentContract,
} from "../src/desktop/renderer/ui-kit/contracts.js";

describe("MUST ui kit contract requirements", () => {
  it("MUST expose typed contracts for public UI kit components", () => {
    const button: ButtonContract = {
      children: "Send",
      type: "button",
    };
    const input: InputContract = {
      value: "hello",
      readOnly: true,
    };
    const dialogContent: DialogContentContract = {
      children: "dialog",
    };
    const card: CardContract = { children: "card" };
    const cardHeader: CardHeaderContract = { children: "header" };
    const cardTitle: CardTitleContract = { children: "title" };
    const cardContent: CardContentContract = { children: "content" };
    const dialogHeader: DialogHeaderContract = { children: "header" };
    const dialogTitle: DialogTitleContract = { children: "title" };
    const dropdownContent: DropdownMenuContentContract = { children: "menu" };
    const dropdownItem: DropdownMenuItemContract = { children: "item" };
    const scroll: ScrollAreaContract = { children: "scroll" };
    const sheet: SheetContentContract = { children: "sheet" };
    const sheetHeader: SheetHeaderContract = { children: "sheet-header" };
    const sidebar: SidebarContract = { children: "sidebar" };
    const skeleton: SkeletonContract = { children: "skeleton" };
    const switchContract: SwitchContract = {};
    const tabsList: TabsListContract = { children: "tabs" };
    const tabsTrigger: TabsTriggerContract = { children: "trigger", value: "a" };
    const tabsContent: TabsContentContract = { children: "content", value: "a" };
    const tooltipContent: TooltipContentContract = {
      children: "tooltip",
    };

    expect(button.children).toBe("Send");
    expect(input.value).toBe("hello");
    expect(dialogContent.children).toBe("dialog");
    expect(tooltipContent.children).toBe("tooltip");
    expect(card.children).toBe("card");
    expect(cardHeader.children).toBe("header");
    expect(cardTitle.children).toBe("title");
    expect(cardContent.children).toBe("content");
    expect(dialogHeader.children).toBe("header");
    expect(dialogTitle.children).toBe("title");
    expect(dropdownContent.children).toBe("menu");
    expect(dropdownItem.children).toBe("item");
    expect(scroll.children).toBe("scroll");
    expect(sheet.children).toBe("sheet");
    expect(sheetHeader.children).toBe("sheet-header");
    expect(sidebar.children).toBe("sidebar");
    expect(skeleton.children).toBe("skeleton");
    expect(switchContract.disabled).toBeUndefined();
    expect(tabsList.children).toBe("tabs");
    expect(tabsTrigger.value).toBe("a");
    expect(tabsContent.value).toBe("a");
  });
});
