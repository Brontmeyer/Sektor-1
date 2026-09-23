"use strict";

class Window_Inventory {
  static PAGE_COUNT = 3;

  static FOCUS = Object.freeze({
    TABS: "tabs",
    ITEMS: "items",
    TARGETS: "targets",
    ARRANGE: "arrange",
    KEY_ITEMS: "keyItems",
  });

  constructor(source) {
    this.party = typeof source?.members === "function" ? source : null;
    this.fallbackActor = this.party ? null : source || null;

    this.visible = false;
    this.pageIndex = 0;
    this.focusArea = Window_Inventory.FOCUS.TABS;
    this.targetIndex = 0;
    this.itemIndex = 0;
    this.arrangeIndex = 0;
    this.keyItemIndex = 0;
    this.sortMode = "default";
    this.pendingItemId = null;

    this.itemViewport = new Window_ListViewport(10);
    this.arrangeViewport = new Window_ListViewport(6);
    this.keyItemViewport = new Window_ListViewport(10);

    this.refreshLayout();
  }

  refreshLayout() {
    const layout = CharacterMenuLayout.calculate();

    this.x = layout.x;
    this.y = layout.y;
    this.width = layout.width;
    this.height = layout.height;
    this.actorBounds = layout.actorBounds;
    this.infoBounds = layout.infoBounds;
    this.descriptionBounds = layout.descriptionBounds;
    this.contentBounds = layout.contentBounds;
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

    this.targetIndex = Math.max(
      0,
      Math.min(this.targetIndex, members.length - 1),
    );
    return members[this.targetIndex] || null;
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
    return (
      item?.keyItem === true ||
      item?.category === "keyItem" ||
      item?.type === "keyItem"
    );
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
        ids.sort(
          (a, b) =>
            countOf(b) - countOf(a) ||
            nameOf(a).localeCompare(nameOf(b)) ||
            a - b,
        );
        break;

      case "least":
        ids.sort(
          (a, b) =>
            countOf(a) - countOf(b) ||
            nameOf(a).localeCompare(nameOf(b)) ||
            a - b,
        );
        break;

      default:
        ids.sort((a, b) => a - b);
        break;
    }

    return ids;
  }

  usableItemIds(mode = this.sortMode) {
    return this.sortedIds(
      this.inventoryItemIds().filter(
        (itemId) => !this.isKeyItem(this.itemRecord(itemId)),
      ),
      mode,
    );
  }

  keyItemIds() {
    return this.sortedIds(
      this.inventoryItemIds().filter((itemId) =>
        this.isKeyItem(this.itemRecord(itemId)),
      ),
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
    this.arrangeIndex = Math.max(
      0,
      Math.min(this.arrangeIndex, options.length - 1),
    );
    return options[this.arrangeIndex] || options[0] || null;
  }

  selectedItemId() {
    if (this.focusArea === Window_Inventory.FOCUS.TARGETS && this.pendingItemId) {
      return this.pendingItemId;
    }

    if (this.pageIndex === 2) {
      const ids = this.keyItemIds();
      this.keyItemIndex = Math.max(
        0,
        Math.min(this.keyItemIndex, Math.max(0, ids.length - 1)),
      );
      return ids[this.keyItemIndex] || null;
    }

    const ids = this.usableItemIds();
    this.itemIndex = Math.max(
      0,
      Math.min(this.itemIndex, Math.max(0, ids.length - 1)),
    );
    return ids[this.itemIndex] || null;
  }

  selectedItem() {
    const itemId = this.selectedItemId();
    return itemId ? this.itemRecord(itemId) : null;
  }

  sortLabel(mode = this.sortMode) {
    const option = this.arrangeOptions().find((entry) => entry.mode === mode);
    return option?.label || "Default";
  }

  pageTitle() {
    return ["USE", "ARRANGE", "KEY ITEMS"][this.pageIndex] || "USE";
  }

  show() {
    this.visible = true;
    this.pageIndex = 0;
    this.focusArea = Window_Inventory.FOCUS.TABS;
    this.pendingItemId = null;
    this.refreshLayout();
    this.syncSelectionState();
  }

  hide() {
    this.visible = false;
    this.pendingItemId = null;
  }

  isOpen() {
    return this.visible;
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
    this.focusArea = Window_Inventory.FOCUS.TABS;
    this.pendingItemId = null;
    this.syncSelectionState();
    return true;
  }

  focusForCurrentPage() {
    if (this.pageIndex === 0) {
      return Window_Inventory.FOCUS.ITEMS;
    }

    if (this.pageIndex === 1) {
      return Window_Inventory.FOCUS.ARRANGE;
    }

    return Window_Inventory.FOCUS.KEY_ITEMS;
  }

  enterCurrentPage() {
    const nextFocus = this.focusForCurrentPage();

    if (
      nextFocus === Window_Inventory.FOCUS.ITEMS &&
      this.usableItemIds().length === 0
    ) {
      return false;
    }

    this.focusArea = nextFocus;
    this.pendingItemId = null;
    this.syncSelectionState();
    return true;
  }

  returnToTabs() {
    this.focusArea = Window_Inventory.FOCUS.TABS;
    this.pendingItemId = null;
  }

  syncSelectionState() {
    const members = this.members();
    const usable = this.usableItemIds();
    const keyItems = this.keyItemIds();
    const options = this.arrangeOptions();

    this.targetIndex = Math.max(
      0,
      Math.min(this.targetIndex, Math.max(0, members.length - 1)),
    );
    this.itemIndex = Math.max(
      0,
      Math.min(this.itemIndex, Math.max(0, usable.length - 1)),
    );
    this.arrangeIndex = Math.max(
      0,
      Math.min(this.arrangeIndex, Math.max(0, options.length - 1)),
    );
    this.keyItemIndex = Math.max(
      0,
      Math.min(this.keyItemIndex, Math.max(0, keyItems.length - 1)),
    );

    if (this.pendingItemId && this.itemCount(this.pendingItemId) <= 0) {
      this.pendingItemId = null;

      if (this.focusArea === Window_Inventory.FOCUS.TARGETS) {
        this.focusArea = Window_Inventory.FOCUS.ITEMS;
      }
    }

    this.itemViewport.maxVisibleRows = this.useVisibleRows();
    this.itemViewport.ensureVisible(this.itemIndex, usable.length);
    this.arrangeViewport.ensureVisible(this.arrangeIndex, options.length);
    this.keyItemViewport.maxVisibleRows = this.keyVisibleRows() * 2;
    this.keyItemViewport.ensureVisible(this.keyItemIndex, keyItems.length);
  }

  update() {
    if (!this.visible) {
      return;
    }

    this.syncSelectionState();

    if (this.actionTriggered("cancel")) {
      this.updateCancel();
      return;
    }

    switch (this.focusArea) {
      case Window_Inventory.FOCUS.TABS:
        this.updateTabs();
        break;
      case Window_Inventory.FOCUS.ITEMS:
        this.updateItemList();
        break;
      case Window_Inventory.FOCUS.TARGETS:
        this.updateTargetList();
        break;
      case Window_Inventory.FOCUS.ARRANGE:
        this.updateArrangePage();
        break;
      case Window_Inventory.FOCUS.KEY_ITEMS:
        this.updateKeyItemsPage();
        break;
      default:
        this.returnToTabs();
        break;
    }
  }

  updateCancel() {
    if (this.focusArea === Window_Inventory.FOCUS.TABS) {
      this.hide();
      return;
    }

    if (this.focusArea === Window_Inventory.FOCUS.TARGETS) {
      this.focusArea = Window_Inventory.FOCUS.ITEMS;
      this.pendingItemId = null;
      return;
    }

    this.returnToTabs();
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

    if (this.actionTriggered("confirm")) {
      this.enterCurrentPage();
    }
  }

  updateItemList() {
    const itemIds = this.usableItemIds();

    if (itemIds.length === 0) {
      this.returnToTabs();
      return;
    }

    if (this.directionRepeated("up")) {
      this.itemIndex =
        (this.itemIndex - 1 + itemIds.length) % itemIds.length;
      this.itemViewport.ensureVisible(this.itemIndex, itemIds.length);
      return;
    }

    if (this.directionRepeated("down")) {
      this.itemIndex = (this.itemIndex + 1) % itemIds.length;
      this.itemViewport.ensureVisible(this.itemIndex, itemIds.length);
      return;
    }

    if (this.actionTriggered("confirm")) {
      const itemId = itemIds[this.itemIndex];

      if (!itemId || this.members().length === 0) {
        return;
      }

      this.pendingItemId = itemId;
      this.targetIndex = Math.max(
        0,
        Math.min(this.targetIndex, this.members().length - 1),
      );
      this.focusArea = Window_Inventory.FOCUS.TARGETS;
    }
  }

  updateTargetList() {
    const members = this.members();

    if (members.length === 0 || !this.pendingItemId) {
      this.focusArea = Window_Inventory.FOCUS.ITEMS;
      this.pendingItemId = null;
      return;
    }

    if (this.directionRepeated("up")) {
      this.targetIndex =
        (this.targetIndex - 1 + members.length) % members.length;
      return;
    }

    if (this.directionRepeated("down")) {
      this.targetIndex = (this.targetIndex + 1) % members.length;
      return;
    }

    if (!this.actionTriggered("confirm")) {
      return;
    }

    const itemId = this.pendingItemId;
    const target = this.actor();

    if (!itemId || !target) {
      return;
    }

    const used = $gameParty?.useItem?.(itemId, target) === true;

    if (!used) {
      return;
    }

    const updated = this.usableItemIds();
    this.itemIndex = Math.max(
      0,
      Math.min(this.itemIndex, Math.max(0, updated.length - 1)),
    );
    this.itemViewport.ensureVisible(this.itemIndex, updated.length);
    this.pendingItemId = null;
    this.focusArea = Window_Inventory.FOCUS.ITEMS;
  }

  updateArrangePage() {
    const options = this.arrangeOptions();

    if (this.directionRepeated("up")) {
      this.arrangeIndex =
        (this.arrangeIndex - 1 + options.length) % options.length;
      this.arrangeViewport.ensureVisible(this.arrangeIndex, options.length);
      return;
    }

    if (this.directionRepeated("down")) {
      this.arrangeIndex = (this.arrangeIndex + 1) % options.length;
      this.arrangeViewport.ensureVisible(this.arrangeIndex, options.length);
      return;
    }

    if (!this.actionTriggered("confirm")) {
      return;
    }

    const option = this.currentArrangeOption();

    if (!option) {
      return;
    }

    this.sortMode = option.mode;
    this.itemViewport.reset(this.itemIndex, this.usableItemIds().length);
    this.returnToTabs();
  }

  updateKeyItemsPage() {
    const itemIds = this.keyItemIds();

    if (itemIds.length === 0) {
      this.returnToTabs();
      return;
    }

    if (this.directionRepeated("up")) {
      this.keyItemIndex =
        (this.keyItemIndex - 1 + itemIds.length) % itemIds.length;
      this.keyItemViewport.ensureVisible(this.keyItemIndex, itemIds.length);
      return;
    }

    if (this.directionRepeated("down")) {
      this.keyItemIndex = (this.keyItemIndex + 1) % itemIds.length;
      this.keyItemViewport.ensureVisible(this.keyItemIndex, itemIds.length);
    }
  }

  pageDescription() {
    if (this.pageIndex === 0) {
      if (this.focusArea === Window_Inventory.FOCUS.TABS) {
        return "Choose an item to use.";
      }

      const item = this.selectedItem();

      if (!item) {
        return "No usable items owned.";
      }

      if (this.focusArea === Window_Inventory.FOCUS.TARGETS) {
        return `Use ${item.name} on ${this.actor()?.name || "a party member"}. ${
          item.description || ""
        }`.trim();
      }

      return item.description || "No description available.";
    }

    if (this.pageIndex === 1) {
      if (this.focusArea === Window_Inventory.FOCUS.TABS) {
        return `Current sort order: ${this.sortLabel()}.`;
      }

      const option = this.currentArrangeOption();
      const suffix =
        option?.mode === this.sortMode
          ? " This order is currently active."
          : " Press Enter to apply.";
      return `${
        option?.description || "Choose how the inventory should be sorted."
      }${suffix}`;
    }

    if (this.focusArea === Window_Inventory.FOCUS.TABS) {
      return "Review important story and progression items.";
    }

    return this.selectedItem()?.description || "No key items owned.";
  }

  infoRows() {
    const item = this.selectedItem();

    if (this.pageIndex === 0) {
      if (this.focusArea === Window_Inventory.FOCUS.TABS) {
        return [
          ["Action", "Use"],
          ["Item", "—"],
          ["Target", "—"],
        ];
      }

      return [
        ["Item", item?.name || "—"],
        ["Quantity", item ? `x${this.itemCount(item.id)}` : "—"],
        [
          "Target",
          this.focusArea === Window_Inventory.FOCUS.TARGETS
            ? this.actor()?.name || "—"
            : "—",
        ],
      ];
    }

    if (this.pageIndex === 1) {
      return [
        ["Current", this.sortLabel()],
        [
          "Selected",
          this.focusArea === Window_Inventory.FOCUS.ARRANGE
            ? this.currentArrangeOption()?.label || "—"
            : "—",
        ],
        ["Confirm", "Apply Order"],
      ];
    }

    return [
      ["Item", item?.name || "—"],
      ["Quantity", item ? `x${this.itemCount(item.id)}` : "—"],
      ["Type", "Key Item"],
    ];
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
      context.fillStyle =
        options.fallbackFill || "rgba(255, 215, 90, 0.12)";
      context.fillRect(x, y, width, height);
    }
  }

  drawActorPanel(context) {
    Window_ActorSummary.draw(context, this.actor(), this.actorBounds);
  }

  drawInfoPanel(context) {
    const bounds = this.infoBounds;
    const rows = this.infoRows();
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

    const labelX = bounds.x + 18;
    const valueX = bounds.x + bounds.width - 18;

    rows.forEach(([label, value], index) => {
      const y = bounds.y + 82 + index * 30;
      context.textAlign = "left";
      context.fillStyle = label === "Target" ? "#7ff0d5" : "#aebbd0";
      context.font = "14px sans-serif";
      context.fillText(label, labelX, y);
      context.textAlign = "right";
      context.fillStyle = this.valueText();
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
      context.fillText(
        this.pageDescription(),
        bounds.x + 18,
        bounds.y + bounds.height / 2,
      );
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
    };
  }

  useVisibleRows() {
    const area = this.tabContentBounds(this.contentBounds);
    return Math.max(5, Math.min(11, Math.floor((area.bodyHeight - 28) / 32)));
  }

  keyVisibleRows() {
    const area = this.tabContentBounds(this.contentBounds);
    return Math.max(4, Math.min(8, Math.floor((area.bodyHeight - 30) / 34)));
  }

  drawTabs(context, bounds) {
    const labels = ["Use", "Arrange", "Key Items"];
    const tabTop = bounds.y + 10;
    const tabHeight = 30;
    const totalTabWidth = Math.min(bounds.width - 40, 470);
    const tabWidth = Math.floor(totalTabWidth / labels.length);
    const startX = bounds.x + 18;

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";

    labels.forEach((label, index) => {
      const x = startX + index * tabWidth;
      const activePage = this.pageIndex === index;
      const focused =
        activePage && this.focusArea === Window_Inventory.FOCUS.TABS;

      if (focused) {
        this.drawSelection(context, x, tabTop - 2, tabWidth - 8, tabHeight);
      }

      context.fillStyle = focused
        ? "#ffd75a"
        : activePage
          ? "#ffffff"
          : "#aebbd0";
      context.font = focused ? "600 17px sans-serif" : "16px sans-serif";
      context.fillText(
        `${focused ? "▶ " : "  "}${label}`,
        x + 10,
        tabTop + tabHeight / 2 - 1,
      );

      if (activePage && !focused) {
        context.strokeStyle = "rgba(127, 240, 213, 0.72)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 10, tabTop + tabHeight - 1);
        context.lineTo(x + tabWidth - 18, tabTop + tabHeight - 1);
        context.stroke();
      }
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

  drawPartyMemberRow(context, actor, bounds, index) {
    const focused =
      this.focusArea === Window_Inventory.FOCUS.TARGETS &&
      index === this.targetIndex;

    this.drawPanel(context, bounds, {
      assetAlpha: 0.34,
      fallbackStroke: focused
        ? "rgba(255, 215, 90, 0.9)"
        : "rgba(150, 176, 220, 0.46)",
      innerStroke: focused
        ? "rgba(255, 230, 140, 0.24)"
        : "rgba(232, 234, 255, 0.1)",
    });

    if (focused) {
      this.drawSelection(
        context,
        bounds.x + 7,
        bounds.y + 6,
        bounds.width - 14,
        bounds.height - 12,
      );
    }

    context.save();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = focused ? "#ffd75a" : "#ffffff";
    context.font = "600 16px sans-serif";
    context.fillText(
      `${focused ? "▶ " : "  "}${actor?.name || "Unknown"}`,
      bounds.x + 10,
      bounds.y + 18,
    );

    context.fillStyle = "#ffd75a";
    context.font = "600 13px sans-serif";
    context.fillText(`LV ${actor?.level ?? "?"}`, bounds.x + 12, bounds.y + 34);

    context.fillStyle = "#aebbd0";
    context.font = "12px sans-serif";
    context.fillText(this.statusText(actor), bounds.x + 88, bounds.y + 34);

    const gaugeX = bounds.x + 12;
    const gaugeWidth = Math.max(80, bounds.width - 24);

    context.fillStyle = this.resourceText("hp");
    context.font = "600 12px sans-serif";
    context.fillText(
      `HP ${Math.floor(actor?.hp ?? 0)}/${Math.floor(actor?.maxHp ?? 0)}`,
      gaugeX,
      bounds.y + 51,
    );
    Window_ActorSummary.drawGauge(
      context,
      actor?.hp ?? 0,
      actor?.maxHp ?? 0,
      gaugeX,
      bounds.y + 55,
      gaugeWidth,
      "hp",
    );

    context.fillStyle = this.resourceText("mp");
    context.fillText(
      `MP ${Math.floor(actor?.mp ?? 0)}/${Math.floor(actor?.maxMp ?? 0)}`,
      gaugeX,
      bounds.y + 68,
    );
    Window_ActorSummary.drawGauge(
      context,
      actor?.mp ?? 0,
      actor?.maxMp ?? 0,
      gaugeX,
      bounds.y + 72,
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
    const leftWidth = Math.max(280, Math.floor(area.bodyWidth * 0.36));
    const dividerX = area.bodyX + leftWidth + 8;
    const rightX = dividerX + 18;
    const rightWidth = area.bodyX + area.bodyWidth - rightX;
    const members = this.members();
    const items = this.usableItemIds();

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(dividerX, area.bodyY + 2);
    context.lineTo(dividerX, area.bodyY + area.bodyHeight - 4);
    context.stroke();

    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText(
      this.focusArea === Window_Inventory.FOCUS.TARGETS
        ? "SELECT TARGET"
        : "PARTY",
      area.bodyX + 6,
      area.bodyY + 12,
    );
    context.fillText(
      this.focusArea === Window_Inventory.FOCUS.ITEMS
        ? "SELECT ITEM"
        : "ITEMS",
      rightX + 6,
      area.bodyY + 12,
    );

    if (members.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No active party members.", area.bodyX + 10, area.bodyY + 46);
    } else {
      const rosterTop = area.bodyY + 28;
      const rowHeight = Math.max(
        75,
        Math.floor((area.bodyHeight - 30) / Math.max(1, members.length)),
      );
      const cardHeight = Math.max(72, rowHeight - 5);

      members.forEach((member, index) => {
        this.drawPartyMemberRow(
          context,
          member,
          {
            x: area.bodyX,
            y: rosterTop + index * rowHeight,
            width: leftWidth,
            height: cardHeight,
          },
          index,
        );
      });
    }

    if (items.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No usable items owned.", rightX + 12, area.bodyY + 48);
      context.restore();
      return;
    }

    const rowHeight = 32;
    const listTop = area.bodyY + 46;
    const range = this.itemViewport.visibleRange(this.itemIndex, items.length);

    for (let i = range.start; i < range.end; i++) {
      const itemId = items[i];
      const item = this.itemRecord(itemId);
      const y = listTop + (i - range.start) * rowHeight;
      const itemFocus =
        this.focusArea === Window_Inventory.FOCUS.ITEMS && i === this.itemIndex;
      const pending =
        this.focusArea === Window_Inventory.FOCUS.TARGETS &&
        itemId === this.pendingItemId;

      if (itemFocus || pending) {
        this.drawSelection(
          context,
          rightX + 6,
          y - 15,
          rightWidth - 16,
          29,
          pending
            ? { fallbackFill: "rgba(127, 240, 213, 0.11)" }
            : {},
        );
      }

      context.fillStyle = itemFocus
        ? "#ffd75a"
        : pending
          ? "#7ff0d5"
          : "#ffffff";
      context.font = itemFocus ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(
        `${itemFocus ? "▶ " : pending ? "◆ " : "  "}${
          item?.name || `Item ${itemId}`
        }`,
        rightX + 12,
        y,
      );

      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.font = "16px sans-serif";
      context.fillText(`x${this.itemCount(itemId)}`, rightX + rightWidth - 8, y);
      context.textAlign = "left";
    }

    this.drawScrollIndicators(
      context,
      rightX + rightWidth - 2,
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
    const dividerX = area.bodyX + leftWidth + 8;
    const rightX = dividerX + 18;
    const rightWidth = area.bodyX + area.bodyWidth - rightX;

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
    context.moveTo(dividerX, area.bodyY + 4);
    context.lineTo(dividerX, area.bodyY + area.bodyHeight - 4);
    context.stroke();

    const range = this.arrangeViewport.visibleRange(
      this.arrangeIndex,
      options.length,
    );
    const optionTop = area.bodyY + 42;
    const optionRowHeight = 34;

    for (let i = range.start; i < range.end; i++) {
      const option = options[i];
      const y = optionTop + (i - range.start) * optionRowHeight;
      const focused =
        this.focusArea === Window_Inventory.FOCUS.ARRANGE &&
        i === this.arrangeIndex;
      const applied = option.mode === this.sortMode;

      if (focused) {
        this.drawSelection(
          context,
          area.bodyX + 6,
          y - 16,
          leftWidth - 20,
          30,
        );
      }

      context.fillStyle = focused
        ? "#ffd75a"
        : applied
          ? "#7ff0d5"
          : "#ffffff";
      context.font = focused ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(
        `${focused ? "▶ " : "  "}${option.label}${applied ? "  ✓" : ""}`,
        area.bodyX + 12,
        y,
      );
    }

    if (previewIds.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No usable items owned.", rightX + 12, area.bodyY + 48);
      context.restore();
      return;
    }

    const previewRowHeight = 30;
    const previewVisible = Math.max(
      5,
      Math.min(10, Math.floor((area.bodyHeight - 24) / previewRowHeight)),
    );

    previewIds.slice(0, previewVisible).forEach((itemId, index) => {
      const item = this.itemRecord(itemId);
      const y = area.bodyY + 42 + index * previewRowHeight;
      context.fillStyle = "#ffffff";
      context.font = "16px sans-serif";
      context.fillText(item?.name || `Item ${itemId}`, rightX + 12, y);
      context.textAlign = "right";
      context.fillText(`x${this.itemCount(itemId)}`, rightX + rightWidth - 8, y);
      context.textAlign = "left";
    });

    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    context.fillText(
      `Current: ${this.sortLabel()}`,
      rightX + 12,
      area.bodyY + area.bodyHeight - 16,
    );
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
      const focused =
        this.focusArea === Window_Inventory.FOCUS.KEY_ITEMS &&
        absoluteIndex === this.keyItemIndex;

      if (focused) {
        this.drawSelection(context, x + 4, y - 16, columnWidth - 8, 30);
      }

      context.fillStyle = focused ? "#ffd75a" : "#ffffff";
      context.font = focused ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(
        `${focused ? "▶ " : "  "}${item?.name || `Item ${itemId}`}`,
        x + 10,
        y,
      );
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

  footerText() {
    const leftRight = `${this.actionLabel("left", "A / ←")}/${this.actionLabel(
      "right",
      "D / →",
    )}`;
    const upDown = `${this.actionLabel("up", "W / ↑")}/${this.actionLabel(
      "down",
      "S / ↓",
    )}`;
    const confirm = this.actionLabel("confirm", "E / Enter");
    const cancel = this.actionLabel("cancel", "Q / Esc");

    switch (this.focusArea) {
      case Window_Inventory.FOCUS.TABS:
        return `${leftRight}: Tab   ${confirm}: Open   ${cancel}: Close`;
      case Window_Inventory.FOCUS.ITEMS:
        return `${upDown}: Item   ${confirm}: Choose Target   ${cancel}: Tabs`;
      case Window_Inventory.FOCUS.TARGETS:
        return `${upDown}: Target   ${confirm}: Use Item   ${cancel}: Items`;
      case Window_Inventory.FOCUS.ARRANGE:
        return `${upDown}: Order   ${confirm}: Apply   ${cancel}: Tabs`;
      case Window_Inventory.FOCUS.KEY_ITEMS:
        return `${upDown}: Key Item   ${cancel}: Tabs`;
      default:
        return `${cancel}: Close`;
    }
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
    context.fillText(this.footerText(), bounds.x + 18, area.footerY);
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
