"use strict";

class Window_Inventory {
  static PAGE_COUNT = 3;

  constructor(source) {
    this.party = typeof source?.members === "function" ? source : null;
    this.fallbackActor = this.party ? null : source || null;

    this.visible = false;
    this.pageIndex = 0;
    this.focusArea = "content";
    this.useFocus = "items";
    this.targetIndex = 0;
    this.itemIndex = 0;
    this.arrangeIndex = 0;
    this.keyItemIndex = 0;
    this.sortMode = "default";

    this.itemViewport = new Window_ListViewport(10);
    this.arrangeViewport = new Window_ListViewport(6);
    this.keyItemViewport = new Window_ListViewport(10);

    this.refreshLayout();
  }

  refreshLayout() {
    const margin = Math.max(12, Math.min(22, Math.floor(Graphics.width * 0.014)));
    const gap = 8;
    const totalWidth = Graphics.width - margin * 2;
    const totalHeight = Graphics.height - margin * 2;
    const headerHeight = Math.max(150, Math.min(174, Math.floor(totalHeight * 0.245)));
    const descriptionHeight = 56;
    const infoWidth = Math.max(260, Math.min(320, Math.floor(totalWidth * 0.255)));

    this.x = margin;
    this.y = margin;
    this.width = totalWidth;
    this.height = totalHeight;

    this.actorBounds = {
      x: this.x,
      y: this.y,
      width: this.width - infoWidth - gap,
      height: headerHeight,
    };
    this.infoBounds = {
      x: this.actorBounds.x + this.actorBounds.width + gap,
      y: this.y,
      width: infoWidth,
      height: headerHeight,
    };
    this.descriptionBounds = {
      x: this.x,
      y: this.y + headerHeight + gap,
      width: this.width,
      height: descriptionHeight,
    };
    this.contentBounds = {
      x: this.x,
      y: this.descriptionBounds.y + descriptionHeight + gap,
      width: this.width,
      height:
        this.y + this.height -
        (this.descriptionBounds.y + descriptionHeight + gap),
    };
  }

  members() {
    if (this.party) {
      if (typeof this.party.battleFormationMembers === "function") {
        return this.party.battleFormationMembers() || [];
      }

      if (typeof this.party.battleMembers === "function") {
        return this.party.battleMembers() || [];
      }

      return this.party.members?.() || [];
    }

    return this.fallbackActor ? [this.fallbackActor] : [];
  }

  actor() {
    const members = this.members();

    if (members.length === 0) {
      return this.fallbackActor || null;
    }

    const clampedIndex = Math.max(0, Math.min(this.targetIndex, members.length - 1));
    this.targetIndex = clampedIndex;
    return members[clampedIndex] || null;
  }

  actionTriggered(action) {
    return typeof Input.isActionTriggered === "function"
      ? Input.isActionTriggered(action)
      : typeof Input.isTriggered === "function"
        ? Input.isTriggered(action)
        : false;
  }

  directionRepeated(action) {
    return typeof Input.isActionRepeated === "function"
      ? Input.isActionRepeated(action)
      : this.actionTriggered(action);
  }

  actionLabel(action, fallback) {
    return typeof Input.actionLabel === "function"
      ? Input.actionLabel(action)
      : fallback;
  }

  changePage(offset) {
    const amount = Number(offset);

    if (!Number.isInteger(amount) || amount === 0) {
      return false;
    }

    this.pageIndex =
      ((this.pageIndex + amount) % Window_Inventory.PAGE_COUNT +
        Window_Inventory.PAGE_COUNT) %
      Window_Inventory.PAGE_COUNT;
    this.focusArea = "tabs";
    this.syncSelectionState();
    return true;
  }

  show() {
    this.visible = true;
    this.pageIndex = 0;
    this.focusArea = "content";
    this.useFocus = "items";
    this.refreshLayout();
    this.syncSelectionState();
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  inventoryItemIds() {
    const explicitIds = typeof $gameParty?.itemIds === "function"
      ? $gameParty.itemIds()
      : Object.keys($gameParty?.items || {}).map(Number);

    return explicitIds
      .map(Number)
      .filter((itemId) => Number.isInteger(itemId) && itemId > 0)
      .filter((itemId) => ($gameParty?.itemCount?.(itemId) || 0) > 0)
      .filter((itemId) => DatabaseManager.item?.(itemId));
  }

  itemCount(itemId) {
    return Math.max(0, Number($gameParty?.itemCount?.(itemId)) || 0);
  }

  itemRecord(itemId) {
    return DatabaseManager.item?.(itemId) || null;
  }

  isKeyItem(item) {
    return item?.keyItem === true || item?.category === "keyItem" || item?.type === "keyItem";
  }

  sortedIds(itemIds, mode = this.sortMode) {
    const ids = itemIds.slice();
    const nameOf = (itemId) => String(this.itemRecord(itemId)?.name || "");
    const countOf = (itemId) => this.itemCount(itemId);

    switch (mode) {
      case "name":
        ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || a - b);
        break;

      case "most":
        ids.sort((a, b) => countOf(b) - countOf(a) || nameOf(a).localeCompare(nameOf(b)) || a - b);
        break;

      case "least":
        ids.sort((a, b) => countOf(a) - countOf(b) || nameOf(a).localeCompare(nameOf(b)) || a - b);
        break;

      default:
        ids.sort((a, b) => a - b);
        break;
    }

    return ids;
  }

  usableItemIds(mode = this.sortMode) {
    return this.sortedIds(
      this.inventoryItemIds().filter((itemId) => !this.isKeyItem(this.itemRecord(itemId))),
      mode,
    );
  }

  keyItemIds() {
    return this.sortedIds(
      this.inventoryItemIds().filter((itemId) => this.isKeyItem(this.itemRecord(itemId))),
      "name",
    );
  }

  arrangeOptions() {
    return [
      {
        mode: "default",
        label: "Default",
        description: "Show items in stable database order.",
      },
      {
        mode: "name",
        label: "Name",
        description: "Sort items alphabetically by name.",
      },
      {
        mode: "most",
        label: "Most",
        description: "Sort items by highest quantity first.",
      },
      {
        mode: "least",
        label: "Least",
        description: "Sort items by lowest quantity first.",
      },
    ];
  }

  currentArrangeOption() {
    const options = this.arrangeOptions();
    const index = Math.max(0, Math.min(this.arrangeIndex, options.length - 1));
    this.arrangeIndex = index;
    return options[index] || options[0] || null;
  }

  selectedItemId() {
    if (this.pageIndex === 2) {
      const ids = this.keyItemIds();
      const clampedIndex = Math.max(0, Math.min(this.keyItemIndex, Math.max(0, ids.length - 1)));
      this.keyItemIndex = clampedIndex;
      return ids[clampedIndex] || null;
    }

    const ids = this.usableItemIds();
    const clampedIndex = Math.max(0, Math.min(this.itemIndex, Math.max(0, ids.length - 1)));
    this.itemIndex = clampedIndex;
    return ids[clampedIndex] || null;
  }

  selectedItem() {
    const itemId = this.selectedItemId();
    return itemId ? this.itemRecord(itemId) : null;
  }

  pageTitle() {
    return ["USE", "ARRANGE", "KEY ITEMS"][this.pageIndex] || "USE";
  }

  tabLabel(index) {
    return ["Use", "Arrange", "Key Items"][index] || "Use";
  }

  sortLabel(mode = this.sortMode) {
    const option = this.arrangeOptions().find((entry) => entry.mode === mode);
    return option?.label || "Default";
  }

  pageDescription() {
    if (this.pageIndex === 0) {
      return this.selectedItem()?.description || "No usable items owned.";
    }

    if (this.pageIndex === 1) {
      const option = this.currentArrangeOption();
      const suffix = option?.mode === this.sortMode ? " Current sort order." : " Press Enter to apply.";
      return `${option?.description || "Choose how the inventory should be sorted."}${suffix}`;
    }

    return this.selectedItem()?.description || "No key items owned.";
  }

  syncSelectionState() {
    const members = this.members();
    this.targetIndex = Math.max(0, Math.min(this.targetIndex, Math.max(0, members.length - 1)));

    const usable = this.usableItemIds();
    const keyItems = this.keyItemIds();
    const options = this.arrangeOptions();

    this.itemIndex = Math.max(0, Math.min(this.itemIndex, Math.max(0, usable.length - 1)));
    this.arrangeIndex = Math.max(0, Math.min(this.arrangeIndex, Math.max(0, options.length - 1)));
    this.keyItemIndex = Math.max(0, Math.min(this.keyItemIndex, Math.max(0, keyItems.length - 1)));

    this.itemViewport.maxVisibleRows = this.useVisibleRows();
    this.itemViewport.ensureVisible(this.itemIndex, usable.length);
    this.arrangeViewport.ensureVisible(this.arrangeIndex, options.length);
    this.keyItemViewport.maxVisibleRows = this.keyVisibleRows() * 2;
    this.keyItemViewport.ensureVisible(this.keyItemIndex, keyItems.length);

    if (this.pageIndex === 0) {
      if (usable.length === 0 && members.length > 0) {
        this.useFocus = "targets";
      } else if (members.length === 0) {
        this.useFocus = "items";
      }
    }
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (this.actionTriggered("cancel")) {
      this.hide();
      return;
    }

    this.syncSelectionState();

    if (this.focusArea === "tabs") {
      this.updateTabs();
      return;
    }

    if (this.pageIndex === 0) {
      this.updateUsePage();
      return;
    }

    if (this.pageIndex === 1) {
      this.updateArrangePage();
      return;
    }

    this.updateKeyItemsPage();
  }

  updateTabs() {
    if (this.actionTriggered("left")) {
      this.changePage(-1);
      return;
    }

    if (this.actionTriggered("right")) {
      this.changePage(1);
      return;
    }

    if (this.actionTriggered("down") || this.actionTriggered("confirm")) {
      this.focusArea = "content";
      this.syncSelectionState();
    }
  }

  toggleUseFocus(direction = 1) {
    const members = this.members();
    const hasTargets = members.length > 0;
    const hasItems = this.usableItemIds().length > 0;

    if (!hasTargets || !hasItems) {
      return false;
    }

    this.useFocus = direction < 0
      ? this.useFocus === "targets" ? "items" : "targets"
      : this.useFocus === "items" ? "targets" : "items";
    return true;
  }

  updateUsePage() {
    const members = this.members();
    const usable = this.usableItemIds();

    if (this.actionTriggered("left")) {
      this.toggleUseFocus(-1);
      return;
    }

    if (this.actionTriggered("right")) {
      this.toggleUseFocus(1);
      return;
    }

    if (this.directionRepeated("up")) {
      if (this.useFocus === "targets") {
        if (this.targetIndex > 0) {
          this.targetIndex -= 1;
        } else {
          this.focusArea = "tabs";
        }
      } else if (this.itemIndex > 0) {
        this.itemIndex -= 1;
        this.itemViewport.ensureVisible(this.itemIndex, usable.length);
      } else {
        this.focusArea = "tabs";
      }

      return;
    }

    if (this.directionRepeated("down")) {
      if (this.useFocus === "targets") {
        if (this.targetIndex < members.length - 1) {
          this.targetIndex += 1;
        }
      } else if (this.itemIndex < usable.length - 1) {
        this.itemIndex += 1;
        this.itemViewport.ensureVisible(this.itemIndex, usable.length);
      }

      return;
    }

    if (this.actionTriggered("confirm")) {
      const itemId = usable[this.itemIndex];
      const target = this.actor();

      if (itemId && target) {
        const used = $gameParty?.useItem?.(itemId, target) === true;

        if (used) {
          const updated = this.usableItemIds();
          this.itemIndex = Math.max(0, Math.min(this.itemIndex, Math.max(0, updated.length - 1)));
          this.itemViewport.ensureVisible(this.itemIndex, updated.length);
        }
      }
    }
  }

  updateArrangePage() {
    const options = this.arrangeOptions();

    if (this.directionRepeated("up")) {
      if (this.arrangeIndex > 0) {
        this.arrangeIndex -= 1;
        this.arrangeViewport.ensureVisible(this.arrangeIndex, options.length);
      } else {
        this.focusArea = "tabs";
      }

      return;
    }

    if (this.directionRepeated("down")) {
      if (this.arrangeIndex < options.length - 1) {
        this.arrangeIndex += 1;
        this.arrangeViewport.ensureVisible(this.arrangeIndex, options.length);
      }

      return;
    }

    if (this.actionTriggered("confirm")) {
      const option = this.currentArrangeOption();

      if (option) {
        this.sortMode = option.mode;
        this.itemViewport.reset(this.itemIndex, this.usableItemIds().length);
      }
    }
  }

  updateKeyItemsPage() {
    const keyItems = this.keyItemIds();

    if (this.directionRepeated("up")) {
      if (this.keyItemIndex > 0) {
        this.keyItemIndex -= 1;
        this.keyItemViewport.ensureVisible(this.keyItemIndex, keyItems.length);
      } else {
        this.focusArea = "tabs";
      }

      return;
    }

    if (this.directionRepeated("down")) {
      if (this.keyItemIndex < keyItems.length - 1) {
        this.keyItemIndex += 1;
        this.keyItemViewport.ensureVisible(this.keyItemIndex, keyItems.length);
      }
    }
  }


  resourceText(resource) {
    return typeof UIResourcePalette !== "undefined"
      ? UIResourcePalette.text(resource)
      : Window_ActorSummary.resourceText(resource);
  }

  valueText() {
    return typeof UIResourcePalette !== "undefined"
      ? UIResourcePalette.valueText()
      : "#ffffff";
  }

  drawPanel(context, bounds, options = {}) {
    return Window_ActorSummary.drawPanel(context, bounds, options);
  }

  drawSelection(context, x, y, width, height, options = {}) {
    const drawn =
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawSelectionPanel === "function" &&
      UIAssetManager.drawSelectionPanel(context, x, y, width, height, {
        alpha: 0.2,
        ...options,
      });

    if (!drawn) {
      context.fillStyle = options.fallbackFill || "rgba(255, 215, 90, 0.12)";
      context.fillRect(x, y, width, height);
    }
  }

  drawActorPanel(context) {
    Window_ActorSummary.draw(context, this.actor(), this.actorBounds);
  }

  drawInfoPanel(context) {
    const bounds = this.infoBounds;
    const members = this.members();
    const actor = this.actor();
    this.drawPanel(context, bounds);

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText("ITEM", bounds.x + bounds.width / 2, bounds.y + 26);

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(
      `${this.pageTitle()}  ${this.pageIndex + 1}/${Window_Inventory.PAGE_COUNT}`,
      bounds.x + bounds.width / 2,
      bounds.y + 50,
    );

    const rows = this.pageIndex === 1
      ? [
        ["Sort", this.sortLabel()],
        ["Options", String(this.arrangeOptions().length)],
        ["Owned", String(this.inventoryItemIds().length)],
      ]
      : this.pageIndex === 2
        ? [
          ["Sort", "Name"],
          ["Owned", String(this.keyItemIds().length)],
          ["Target", actor?.name || "None"],
        ]
        : [
          ["Sort", this.sortLabel()],
          ["Owned", String(this.inventoryItemIds().length)],
          ["Target", members.length > 0 ? actor?.name || "None" : "None"],
        ];

    const labelX = bounds.x + 18;
    const valueX = bounds.x + bounds.width - 18;
    rows.forEach(([label, value], index) => {
      const y = bounds.y + 82 + index * 30;
      context.textAlign = "left";
      context.font = "14px sans-serif";
      context.fillStyle = label === "Target" ? "#7ff0d5" : "#aebbd0";
      context.fillText(`${label}`, labelX, y);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.fillText(String(value), valueX, y);
    });

    context.restore();
  }

  drawDescription(context) {
    const bounds = this.descriptionBounds;
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";

    if (
      typeof Window_TextLayout !== "undefined" &&
      Window_TextLayout.drawWrappedText
    ) {
      Window_TextLayout.drawWrappedText(
        context,
        this.pageDescription(),
        bounds.x + 18,
        bounds.y + 21,
        bounds.width - 36,
        18,
        2,
      );
    } else {
      context.fillText(this.pageDescription(), bounds.x + 18, bounds.y + bounds.height / 2);
    }

    context.restore();
  }

  tabContentBounds(bounds) {
    const footerHeight = 38;
    const tabsBottom = bounds.y + 50;
    const footerTop = bounds.y + bounds.height - footerHeight;
    return {
      bodyX: bounds.x + 16,
      bodyY: tabsBottom + 12,
      bodyWidth: bounds.width - 32,
      bodyHeight: Math.max(0, footerTop - (tabsBottom + 12) - 8),
      footerTop,
      footerY: footerTop + footerHeight / 2,
      tabsBottom,
    };
  }

  useVisibleRows() {
    const area = this.tabContentBounds(this.contentBounds);
    return Math.max(5, Math.min(11, Math.floor((area.bodyHeight - 32) / 32)));
  }

  keyVisibleRows() {
    const area = this.tabContentBounds(this.contentBounds);
    return Math.max(4, Math.min(8, Math.floor((area.bodyHeight - 30) / 34)));
  }

  drawTabs(context, bounds) {
    const tabLabels = ["Use", "Arrange", "Key Items"];
    const tabTop = bounds.y + 10;
    const tabHeight = 28;
    const totalTabWidth = Math.min(bounds.width - 40, 440);
    const tabWidth = Math.floor(totalTabWidth / tabLabels.length);
    const startX = bounds.x + 18;

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "center";

    tabLabels.forEach((label, index) => {
      const x = startX + index * tabWidth;
      const selected = this.pageIndex === index;
      const focused = selected && this.focusArea === "tabs";

      if (selected) {
        this.drawSelection(context, x, tabTop - 2, tabWidth - 8, tabHeight, {
          fallbackFill: focused ? "rgba(127, 240, 213, 0.18)" : "rgba(255, 215, 90, 0.12)",
        });
      }

      context.fillStyle = selected ? "#ffffff" : "#aebbd0";
      context.font = selected ? "600 17px sans-serif" : "16px sans-serif";
      context.fillText(label, x + (tabWidth - 8) / 2, tabTop + tabHeight / 2 - 1);
    });

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 18, bounds.y + 50);
    context.lineTo(bounds.x + bounds.width - 18, bounds.y + 50);
    context.stroke();
    context.restore();
  }

  statusText(actor) {
    const entries = actor?.statusDisplayEntries?.() || [];

    if (entries.length > 0) {
      return entries[0]?.name || "Normal";
    }

    const summary = actor?.statusSummary?.(1) || "";
    return summary || "Normal";
  }

  drawPartyMemberRow(context, actor, bounds, selected) {
    this.drawPanel(context, bounds, {
      assetAlpha: 0.36,
      fallbackStroke: selected
        ? "rgba(255, 215, 90, 0.92)"
        : "rgba(150, 176, 220, 0.46)",
      innerStroke: selected
        ? "rgba(255, 230, 140, 0.25)"
        : "rgba(232, 234, 255, 0.1)",
    });

    if (selected && this.useFocus === "targets" && this.pageIndex === 0 && this.focusArea === "content") {
      this.drawSelection(context, bounds.x + 8, bounds.y + 8, bounds.width - 16, bounds.height - 16);
    }

    context.save();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 17px sans-serif";
    context.fillText(actor?.name || "Unknown", bounds.x + 12, bounds.y + 24);

    context.fillStyle = "#ffd75a";
    context.font = "600 14px sans-serif";
    context.fillText(`LV ${actor?.level ?? "?"}`, bounds.x + 12, bounds.y + 45);

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(this.statusText(actor), bounds.x + 90, bounds.y + 45);

    const gaugeX = bounds.x + 12;
    const gaugeWidth = Math.max(80, bounds.width - 24);

    context.fillStyle = this.resourceText("hp");
    context.font = "600 13px sans-serif";
    context.fillText(`HP ${Math.floor(actor?.hp ?? 0)}/${Math.floor(actor?.maxHp ?? 0)}`, gaugeX, bounds.y + 65);
    Window_ActorSummary.drawGauge(
      context,
      actor?.hp ?? 0,
      actor?.maxHp ?? 0,
      gaugeX,
      bounds.y + 70,
      gaugeWidth,
      "hp",
    );

    context.fillStyle = this.resourceText("mp");
    context.fillText(`MP ${Math.floor(actor?.mp ?? 0)}/${Math.floor(actor?.maxMp ?? 0)}`, gaugeX, bounds.y + 88);
    Window_ActorSummary.drawGauge(
      context,
      actor?.mp ?? 0,
      actor?.maxMp ?? 0,
      gaugeX,
      bounds.y + 93,
      gaugeWidth,
      "mp",
    );

    context.restore();
  }

  drawScrollIndicators(context, x, topY, bottomY, hasPrevious, hasNext) {
    context.save();
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";

    if (hasPrevious) {
      context.fillText("▲", x, topY);
    }

    if (hasNext) {
      context.fillText("▼", x, bottomY);
    }

    context.restore();
  }

  drawUsePage(context, area) {
    const leftWidth = Math.max(270, Math.floor(area.bodyWidth * 0.34));
    const rightX = area.bodyX + leftWidth + 18;
    const rightWidth = area.bodyWidth - leftWidth - 18;
    const members = this.members();
    const items = this.usableItemIds();

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("PARTY", area.bodyX + 6, area.bodyY + 10);
    context.fillText("ITEMS", rightX + 6, area.bodyY + 10);

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(area.bodyX + leftWidth + 8, area.bodyY + 4);
    context.lineTo(area.bodyX + leftWidth + 8, area.bodyY + area.bodyHeight - 4);
    context.stroke();

    if (members.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No active party members.", area.bodyX + 14, area.bodyY + 48);
    } else {
      const rowHeight = Math.max(78, Math.min(98, Math.floor((area.bodyHeight - 30) / Math.max(1, members.length))));
      members.forEach((member, index) => {
        this.drawPartyMemberRow(
          context,
          member,
          {
            x: area.bodyX,
            y: area.bodyY + 24 + index * rowHeight,
            width: leftWidth,
            height: rowHeight - 8,
          },
          index === this.targetIndex,
        );
      });
    }

    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    context.fillText(`Sort: ${this.sortLabel()}`, rightX + 8, area.bodyY + 10);

    if (items.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No usable items owned.", rightX + 12, area.bodyY + 48);
      context.restore();
      return;
    }

    const rowHeight = 30;
    const listTop = area.bodyY + 42;
    const range = this.itemViewport.visibleRange(this.itemIndex, items.length);

    for (let i = range.start; i < range.end; i++) {
      const itemId = items[i];
      const item = this.itemRecord(itemId);
      const y = listTop + (i - range.start) * rowHeight;
      const selected = i === this.itemIndex;

      if (selected) {
        this.drawSelection(context, rightX + 6, y - 15, rightWidth - 20, 28);
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(`${selected && this.useFocus === "items" && this.focusArea === "content" ? "▶ " : "  "}${item?.name || `Item ${itemId}`}`, rightX + 12, y);

      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.font = "16px sans-serif";
      context.fillText(`x${this.itemCount(itemId)}`, rightX + rightWidth - 12, y);
      context.textAlign = "left";
    }

    this.drawScrollIndicators(
      context,
      rightX + rightWidth - 6,
      area.bodyY + 42,
      area.bodyY + area.bodyHeight - 28,
      this.itemViewport.hasPrevious(),
      this.itemViewport.hasNext(items.length),
    );

    context.restore();
  }

  drawArrangePage(context, area) {
    const options = this.arrangeOptions();
    const previewMode = this.currentArrangeOption()?.mode || this.sortMode;
    const previewIds = this.usableItemIds(previewMode);
    const leftWidth = Math.max(260, Math.floor(area.bodyWidth * 0.31));
    const rightX = area.bodyX + leftWidth + 18;
    const rightWidth = area.bodyWidth - leftWidth - 18;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("SORT", area.bodyX + 6, area.bodyY + 10);
    context.fillText("PREVIEW", rightX + 6, area.bodyY + 10);

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(area.bodyX + leftWidth + 8, area.bodyY + 4);
    context.lineTo(area.bodyX + leftWidth + 8, area.bodyY + area.bodyHeight - 4);
    context.stroke();

    const optionRange = this.arrangeViewport.visibleRange(this.arrangeIndex, options.length);
    const optionTop = area.bodyY + 42;
    const optionRowHeight = 34;

    for (let i = optionRange.start; i < optionRange.end; i++) {
      const option = options[i];
      const y = optionTop + (i - optionRange.start) * optionRowHeight;
      const selected = i === this.arrangeIndex;
      const applied = option.mode === this.sortMode;

      if (selected) {
        this.drawSelection(context, area.bodyX + 6, y - 16, leftWidth - 20, 30);
      }

      context.fillStyle = selected ? "#ffd75a" : applied ? "#7ff0d5" : "#ffffff";
      context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
      const appliedTag = applied ? " *" : "";
      context.fillText(`${selected && this.focusArea === "content" ? "▶ " : "  "}${option.label}${appliedTag}`, area.bodyX + 12, y);
    }

    if (previewIds.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No usable items owned.", rightX + 12, area.bodyY + 48);
      context.restore();
      return;
    }

    const previewRowHeight = 30;
    const previewVisible = Math.max(5, Math.min(10, Math.floor((area.bodyHeight - 24) / previewRowHeight)));
    previewIds.slice(0, previewVisible).forEach((itemId, index) => {
      const item = this.itemRecord(itemId);
      const y = area.bodyY + 42 + index * previewRowHeight;
      context.fillStyle = "#ffffff";
      context.font = "16px sans-serif";
      context.fillText(item?.name || `Item ${itemId}`, rightX + 12, y);
      context.textAlign = "right";
      context.fillText(`x${this.itemCount(itemId)}`, rightX + rightWidth - 12, y);
      context.textAlign = "left";
    });

    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    context.fillText(`Applied Sort: ${this.sortLabel()}`, rightX + 12, area.bodyY + area.bodyHeight - 16);
    context.restore();
  }

  drawKeyItemsPage(context, area) {
    const itemIds = this.keyItemIds();

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("KEY ITEMS", area.bodyX + 6, area.bodyY + 10);

    if (itemIds.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No key items owned.", area.bodyX + 14, area.bodyY + 52);
      context.restore();
      return;
    }

    const rowsPerColumn = this.keyVisibleRows();
    const columnGap = 20;
    const columnWidth = Math.floor((area.bodyWidth - columnGap) / 2);
    const start = this.keyItemViewport.offset;
    const visible = itemIds.slice(start, start + rowsPerColumn * 2);
    const rowHeight = 34;

    visible.forEach((itemId, visibleIndex) => {
      const item = this.itemRecord(itemId);
      const absoluteIndex = start + visibleIndex;
      const column = Math.floor(visibleIndex / rowsPerColumn);
      const row = visibleIndex % rowsPerColumn;
      const x = area.bodyX + column * (columnWidth + columnGap);
      const y = area.bodyY + 44 + row * rowHeight;
      const selected = absoluteIndex === this.keyItemIndex;

      if (selected) {
        this.drawSelection(context, x + 4, y - 16, columnWidth - 8, 30);
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(`${selected && this.focusArea === "content" ? "▶ " : "  "}${item?.name || `Item ${itemId}`}`, x + 10, y);
    });

    this.drawScrollIndicators(
      context,
      area.bodyX + area.bodyWidth - 8,
      area.bodyY + 42,
      area.bodyY + area.bodyHeight - 28,
      this.keyItemViewport.hasPrevious(),
      this.keyItemViewport.hasNext(itemIds.length),
    );
    context.restore();
  }

  drawContent(context) {
    const bounds = this.contentBounds;
    this.drawPanel(context, bounds);
    this.drawTabs(context, bounds);

    const area = this.tabContentBounds(bounds);

    if (this.pageIndex === 0) {
      this.drawUsePage(context, area);
    } else if (this.pageIndex === 1) {
      this.drawArrangePage(context, area);
    } else {
      this.drawKeyItemsPage(context, area);
    }

    context.save();
    context.strokeStyle = "rgba(210, 222, 242, 0.34)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 20, area.footerTop);
    context.lineTo(bounds.x + bounds.width - 20, area.footerTop);
    context.stroke();

    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";

    const focusHint = this.pageIndex === 0
      ? `${this.actionLabel("left", "A / ←")}/${this.actionLabel("right", "D / →")}: Tabs/Target/Items   `
      : `${this.actionLabel("left", "A / ←")}/${this.actionLabel("right", "D / →")}: Tabs   `;
    const navHint = `${this.actionLabel("up", "W / ↑")}/${this.actionLabel("down", "S / ↓")}: Navigate   `;
    const actionHint = this.pageIndex === 1
      ? `${this.actionLabel("confirm", "E / Enter")}: Apply   `
      : this.pageIndex === 2
        ? ""
        : `${this.actionLabel("confirm", "E / Enter")}: Use   `;

    context.fillText(
      `${focusHint}${navHint}${actionHint}${this.actionLabel("cancel", "Q / Esc")}: Close`,
      bounds.x + 18,
      area.footerY,
    );
    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    this.drawActorPanel(context);
    this.drawInfoPanel(context);
    this.drawDescription(context);
    this.drawContent(context);

    context.restore();
  }
}
