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

  equipmentInventoryEntries() {
    const definitions = [
      { type: "weapon", store: "weapons", getter: "weapon" },
      { type: "armor", store: "armors", getter: "armor" },
      { type: "accessory", store: "accessories", getter: "accessory" },
    ];
    const entries = [];

    for (const definition of definitions) {
      const inventory = $gameParty?.[definition.store] || {};
      const getter = DatabaseManager?.[definition.getter];

      if (typeof getter !== "function") {
        continue;
      }

      Object.keys(inventory)
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
        .sort((a, b) => a - b)
        .forEach((id) => {
          const owned = Math.max(0, Number(inventory[id]) || 0);
          const quantity =
            typeof $gameParty?.unequippedMerchandiseCount === "function"
              ? Math.max(
                  0,
                  Number($gameParty.unequippedMerchandiseCount(definition.type, id)) || 0,
                )
              : Math.max(
                  0,
                  owned -
                    (typeof $gameParty?.equippedMerchandiseCount === "function"
                      ? Math.max(
                          0,
                          Number($gameParty.equippedMerchandiseCount(definition.type, id)) || 0,
                        )
                      : 0),
                );
          const record = getter.call(DatabaseManager, id);

          if (quantity <= 0 || !record) {
            return;
          }

          entries.push({
            kind: "equipment",
            type: definition.type,
            id,
            record,
            quantity,
            usable: false,
          });
        });
    }

    return entries;
  }

  inventoryDisplayEntries(mode = this.sortMode) {
    const items = this.usableItemIds(mode).map((itemId) => ({
      kind: "item",
      type: "item",
      id: itemId,
      record: this.itemRecord(itemId),
      quantity: this.itemCount(itemId),
      usable: true,
    }));

    return [...items, ...this.equipmentInventoryEntries()];
  }

  selectedInventoryEntry() {
    if (this.focusArea === Window_Inventory.FOCUS.TARGETS && this.pendingItemId) {
      return {
        kind: "item",
        type: "item",
        id: this.pendingItemId,
        record: this.itemRecord(this.pendingItemId),
        quantity: this.itemCount(this.pendingItemId),
        usable: true,
      };
    }

    if (this.pageIndex !== 0) {
      return null;
    }

    const entries = this.inventoryDisplayEntries();
    this.itemIndex = Math.max(
      0,
      Math.min(this.itemIndex, Math.max(0, entries.length - 1)),
    );
    return entries[this.itemIndex] || null;
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

    const entry = this.selectedInventoryEntry();
    return entry?.kind === "item" ? entry.id : null;
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

  pageEnabled(index) {
    if (index === 2) {
      return this.keyItemIds().length > 0;
    }

    return index >= 0 && index < Window_Inventory.PAGE_COUNT;
  }

  changePage(offset) {
    const amount = Number(offset);

    if (!Number.isInteger(amount) || amount === 0) {
      return false;
    }

    const direction = amount < 0 ? -1 : 1;
    const moves = Math.abs(amount);
    let nextPage = this.pageIndex;

    for (let move = 0; move < moves; move++) {
      for (let attempts = 0; attempts < Window_Inventory.PAGE_COUNT; attempts++) {
        nextPage =
          ((nextPage + direction) % Window_Inventory.PAGE_COUNT +
            Window_Inventory.PAGE_COUNT) %
          Window_Inventory.PAGE_COUNT;

        if (this.pageEnabled(nextPage)) {
          break;
        }
      }
    }

    this.pageIndex = nextPage;
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
      this.inventoryDisplayEntries().length === 0
    ) {
      return false;
    }

    if (
      nextFocus === Window_Inventory.FOCUS.KEY_ITEMS &&
      this.keyItemIds().length === 0
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
    const inventoryEntries = this.inventoryDisplayEntries();
    const keyItems = this.keyItemIds();
    const options = this.arrangeOptions();

    if (this.pageIndex === 2 && keyItems.length === 0) {
      this.pageIndex = 1;
      this.focusArea = Window_Inventory.FOCUS.TABS;
    }

    this.targetIndex = Math.max(
      0,
      Math.min(this.targetIndex, Math.max(0, members.length - 1)),
    );
    this.itemIndex = Math.max(
      0,
      Math.min(this.itemIndex, Math.max(0, inventoryEntries.length - 1)),
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
    this.itemViewport.ensureVisible(this.itemIndex, inventoryEntries.length);
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
    const entries = this.inventoryDisplayEntries();

    if (entries.length === 0) {
      this.returnToTabs();
      return;
    }

    if (this.directionRepeated("up")) {
      this.itemIndex = (this.itemIndex - 1 + entries.length) % entries.length;
      this.itemViewport.ensureVisible(this.itemIndex, entries.length);
      return;
    }

    if (this.directionRepeated("down")) {
      this.itemIndex = (this.itemIndex + 1) % entries.length;
      this.itemViewport.ensureVisible(this.itemIndex, entries.length);
      return;
    }

    if (!this.actionTriggered("confirm")) {
      return;
    }

    const entry = entries[this.itemIndex];

    if (!entry?.usable || entry.kind !== "item" || this.members().length === 0) {
      return;
    }

    this.pendingItemId = entry.id;
    this.targetIndex = Math.max(
      0,
      Math.min(this.targetIndex, this.members().length - 1),
    );
    this.focusArea = Window_Inventory.FOCUS.TARGETS;
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

    const remaining = this.itemCount(itemId);
    const updated = this.inventoryDisplayEntries();
    const updatedIndex = updated.findIndex(
      (entry) => entry.kind === "item" && entry.id === itemId,
    );
    this.itemIndex = updatedIndex >= 0
      ? updatedIndex
      : Math.max(0, Math.min(this.itemIndex, Math.max(0, updated.length - 1)));
    this.itemViewport.ensureVisible(this.itemIndex, updated.length);

    if (remaining <= 0) {
      this.pendingItemId = null;
      this.focusArea = Window_Inventory.FOCUS.ITEMS;
      return;
    }

    // Keep the chosen item armed so the player can heal several actors, or
    // the same actor repeatedly, without reopening the item list after every
    // successful use. Cancel remains the explicit way back to item selection.
    this.pendingItemId = itemId;
    this.focusArea = Window_Inventory.FOCUS.TARGETS;
  }

  updateArrangePage() {
    const options = this.arrangeOptions();

    if (this.directionRepeated("up")) {
      this.arrangeIndex =
        (this.arrangeIndex - 1 + options.length) % options.length;
      return;
    }

    if (this.directionRepeated("down")) {
      this.arrangeIndex = (this.arrangeIndex + 1) % options.length;
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
    this.itemViewport.reset(this.itemIndex, this.inventoryDisplayEntries().length);
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

      const entry = this.selectedInventoryEntry();
      const item = entry?.kind === "item" ? entry.record : null;

      if (entry?.kind === "equipment") {
        return `${entry.record?.name || "Equipment"} is owned equipment. Manage it from EQUIP.`;
      }

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
    const inventoryEntry = this.selectedInventoryEntry();

    if (this.pageIndex === 0) {
      if (this.focusArea === Window_Inventory.FOCUS.TABS) {
        return [];
      }

      if (inventoryEntry?.kind === "equipment") {
        return [
          ["Item", inventoryEntry.record?.name || "—"],
          ["Quantity", `x${inventoryEntry.quantity}`],
        ];
      }

      const rows = [
        ["Item", item?.name || "—"],
        ["Quantity", item ? `x${this.itemCount(item.id)}` : "—"],
      ];

      if (this.focusArea === Window_Inventory.FOCUS.TARGETS) {
        rows.push(["Target", this.actor()?.name || "—"]);
      }

      return rows;
    }

    if (this.pageIndex === 1) {
      const rows = [["Order", this.sortLabel()]];

      if (this.focusArea === Window_Inventory.FOCUS.ARRANGE) {
        const selected = this.currentArrangeOption()?.label || "—";
        if (selected !== this.sortLabel()) {
          rows.push(["Selected", selected]);
        }
      }

      return rows;
    }

    if (this.focusArea === Window_Inventory.FOCUS.TABS || !item) {
      return [];
    }

    return [
      ["Item", item.name || "—"],
      ["Quantity", `x${this.itemCount(item.id)}`],
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

  drawPartyInventoryPanel(context) {
    const bounds = this.actorBounds;

    this.drawPanel(context, bounds);
    CharacterMenuLayout.drawContextHeading(context, bounds, {
      title: "PARTY INVENTORY",
      descriptions: [
        "Shared inventory for the active party.",
        "Usable items, owned equipment, and key items all live here.",
      ],
    });
  }

  drawInfoPanel(context) {
    const bounds = this.infoBounds;
    const rows = this.infoRows();
    this.drawPanel(context, bounds);

    context.save();
    const subtitle = `${this.pageTitle()}  ${this.pageIndex + 1}/${Window_Inventory.PAGE_COUNT}`;
    const heading = CharacterMenuLayout.drawInfoHeading(context, bounds, {
      title: "ITEM",
      subtitle,
    });
    context.textBaseline = "middle";

    const labelX = heading.labelX;
    const valueX = heading.valueX;

    rows.forEach(([label, value], index) => {
      const y = CharacterMenuLayout.infoRowY(bounds, index, { subtitle });
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
      Window_TextLayout.drawWrappedTextCentered(
        context,
        this.pageDescription(),
        bounds.x + 18,
        bounds.y + bounds.height / 2,
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

  contentColumns(bounds = this.contentBounds) {
    const inset = 16;
    const innerX = bounds.x + inset;
    const innerY = bounds.y + 12;
    const innerWidth = bounds.width - inset * 2;
    const innerHeight = bounds.height - 24;
    const leftWidth = Math.max(320, Math.floor(innerWidth * 0.37));
    const dividerX = innerX + leftWidth + 8;
    const rightX = dividerX + 18;
    const rightWidth = innerX + innerWidth - rightX;
    const tabHeight = 34;
    const tabTop = innerY + 2;
    const tabBottom = tabTop + tabHeight + 8;

    return {
      innerX,
      innerY,
      innerWidth,
      innerHeight,
      leftX: innerX,
      leftWidth,
      leftTop: innerY + 2,
      leftHeight: innerHeight - 4,
      dividerX,
      rightX,
      rightWidth,
      tabTop,
      tabHeight,
      tabBottom,
      rightBodyY: tabBottom + 10,
      rightBodyHeight: Math.max(0, innerY + innerHeight - (tabBottom + 10) - 2),
    };
  }

  contentRhythm(columns = this.contentColumns()) {
    const headingY = columns.rightBodyY + 12;
    const firstRowY = headingY + 42;

    return {
      headingY,
      firstRowY,
      emptyY: firstRowY,
      scrollTopY: firstRowY - 4,
    };
  }

  contentRowGeometry(columns = this.contentColumns(), bounds = null) {
    const rhythm = this.contentRhythm(columns);
    const rowX = bounds?.x ?? columns.rightX;
    const rowWidth = bounds?.width ?? columns.rightWidth;

    return {
      firstRowY: rhythm.firstRowY,
      rowHeight: 32,
      cursorX: rowX + 12,
      textX: rowX + 34,
      quantityX: rowX + rowWidth - 8,
    };
  }

  drawRowMarker(context, marker, x, y, color = "#ffd75a") {
    if (!marker) {
      return;
    }

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.font = "600 17px sans-serif";
    context.fillText(marker, x, y);
    context.restore();
  }

  useVisibleRows() {
    const columns = this.contentColumns();
    return Math.max(
      5,
      Math.min(11, Math.floor((columns.rightBodyHeight - 38) / 32)),
    );
  }

  keyVisibleRows() {
    const columns = this.contentColumns();
    return Math.max(
      4,
      Math.min(8, Math.floor((columns.rightBodyHeight - 38) / 34)),
    );
  }

  drawTabs(context, columns) {
    const labels = ["Use", "Arrange", "Key Items"];
    const tabWidth = columns.rightWidth / labels.length;

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";

    labels.forEach((label, index) => {
      const cellX = columns.rightX + index * tabWidth;
      const x = Math.round(cellX);
      const width = Math.round(columns.rightX + (index + 1) * tabWidth) - x;
      const activePage = this.pageIndex === index;
      const enabled = this.pageEnabled(index);
      const focused =
        enabled && activePage && this.focusArea === Window_Inventory.FOCUS.TABS;

      if (focused) {
        this.drawSelection(
          context,
          x + 4,
          columns.tabTop,
          Math.max(0, width - 8),
          columns.tabHeight,
        );
      }

      context.fillStyle = !enabled
        ? "#6f7d92"
        : focused
          ? "#ffd75a"
          : activePage
            ? "#ffffff"
            : "#aebbd0";
      context.font = focused ? "600 17px sans-serif" : "16px sans-serif";
      context.fillText(
        `${focused ? "▶ " : "  "}${label}`,
        x + 12,
        columns.tabTop + columns.tabHeight / 2,
      );

      if (enabled && activePage && !focused) {
        context.strokeStyle = "rgba(127, 240, 213, 0.72)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 12, columns.tabTop + columns.tabHeight - 1);
        context.lineTo(x + width - 12, columns.tabTop + columns.tabHeight - 1);
        context.stroke();
      }
    });

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(columns.rightX, columns.tabBottom);
    context.lineTo(columns.rightX + columns.rightWidth, columns.tabBottom);
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
    context.font = "600 17px sans-serif";
    context.fillText(
      `${focused ? "▶ " : "  "}${actor?.name || "Unknown"}`,
      bounds.x + 12,
      bounds.y + 23,
    );

    context.fillStyle = "#ffd75a";
    context.font = "600 13px sans-serif";
    context.fillText(`LV ${actor?.level ?? "?"}`, bounds.x + 14, bounds.y + 43);

    context.fillStyle = "#aebbd0";
    context.font = "12px sans-serif";
    context.fillText(this.statusText(actor), bounds.x + 92, bounds.y + 43);

    const gaugeX = bounds.x + 14;
    const gaugeWidth = Math.max(80, bounds.width - 28);

    context.fillStyle = this.resourceText("hp");
    context.font = "600 12px sans-serif";
    context.fillText(
      `HP ${Math.floor(actor?.hp ?? 0)}/${Math.floor(actor?.maxHp ?? 0)}`,
      gaugeX,
      bounds.y + 59,
    );
    Window_ActorSummary.drawGauge(
      context,
      actor?.hp ?? 0,
      actor?.maxHp ?? 0,
      gaugeX,
      bounds.y + 64,
      gaugeWidth,
      "hp",
    );

    context.fillStyle = this.resourceText("mp");
    context.fillText(
      `MP ${Math.floor(actor?.mp ?? 0)}/${Math.floor(actor?.maxMp ?? 0)}`,
      gaugeX,
      bounds.y + 81,
    );
    Window_ActorSummary.drawGauge(
      context,
      actor?.mp ?? 0,
      actor?.maxMp ?? 0,
      gaugeX,
      bounds.y + 86,
      gaugeWidth,
      "mp",
    );

    context.restore();
  }

  drawPartyRoster(context, columns) {
    const members = this.members();

    if (members.length === 0) {
      context.save();
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText(
        "No active party members.",
        columns.leftX + 10,
        columns.leftTop + 28,
      );
      context.restore();
      return;
    }

    const gap = 6;
    const availableCardHeight = Math.floor(
      (columns.leftHeight - gap * (members.length - 1)) / members.length,
    );
    const cardHeight = Math.max(96, Math.min(108, availableCardHeight));

    members.forEach((member, index) => {
      this.drawPartyMemberRow(
        context,
        member,
        {
          x: columns.leftX,
          y: columns.leftTop + index * (cardHeight + gap),
          width: Math.max(0, columns.leftWidth - 14),
          height: cardHeight,
        },
        index,
      );
    });
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

  drawContentDivider(context, columns) {
    context.save();
    context.strokeStyle = "rgba(210, 222, 242, 0.3)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(columns.dividerX, columns.innerY);
    context.lineTo(columns.dividerX, columns.innerY + columns.innerHeight);
    context.stroke();
    context.restore();
  }

  drawUsePage(context, columns) {
    const entries = this.inventoryDisplayEntries();
    const rhythm = this.contentRhythm(columns);

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText(
      this.focusArea === Window_Inventory.FOCUS.ITEMS
        ? "SELECT ITEM"
        : "ITEMS",
      columns.rightX + 6,
      rhythm.headingY,
    );

    if (entries.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText(
        "No usable items owned.",
        columns.rightX + 12,
        rhythm.emptyY,
      );
      context.restore();
      return;
    }

    const row = this.contentRowGeometry(columns);
    const range = this.itemViewport.visibleRange(this.itemIndex, entries.length);

    for (let i = range.start; i < range.end; i++) {
      const entry = entries[i];
      const itemId = entry?.id;
      const item = entry?.record;
      const y = row.firstRowY + (i - range.start) * row.rowHeight;
      const itemFocus =
        this.focusArea === Window_Inventory.FOCUS.ITEMS && i === this.itemIndex;
      const pending =
        this.focusArea === Window_Inventory.FOCUS.TARGETS &&
        entry?.kind === "item" && itemId === this.pendingItemId;

      if (itemFocus || pending) {
        this.drawSelection(
          context,
          columns.rightX + 6,
          y - 15,
          columns.rightWidth - 16,
          29,
          pending
            ? { fallbackFill: "rgba(127, 240, 213, 0.11)" }
            : {},
        );
      }

      const disabled = entry?.usable === false;
      context.fillStyle = itemFocus
        ? disabled
          ? "#9aa6b8"
          : "#ffd75a"
        : pending
          ? "#7ff0d5"
          : disabled
            ? "#6f7d92"
            : "#ffffff";
      context.font = itemFocus ? "600 17px sans-serif" : "17px sans-serif";
      const typeTag = disabled
        ? ` [${entry.type === "accessory" ? "ACC" : entry.type.toUpperCase()}]`
        : "";
      this.drawRowMarker(
        context,
        itemFocus ? "▶" : pending ? "◆" : "",
        row.cursorX,
        y,
        itemFocus ? (disabled ? "#9aa6b8" : "#ffd75a") : "#7ff0d5",
      );
      context.fillText(
        `${item?.name || `Item ${itemId}`}${typeTag}`,
        row.textX,
        y,
      );

      context.textAlign = "right";
      context.fillStyle = disabled ? "#6f7d92" : "#ffffff";
      context.font = "16px sans-serif";
      context.fillText(
        `x${entry?.quantity ?? 0}`,
        row.quantityX,
        y,
      );
      context.textAlign = "left";
    }

    this.drawScrollIndicators(
      context,
      columns.rightX + columns.rightWidth - 2,
      rhythm.scrollTopY,
      columns.rightBodyY + columns.rightBodyHeight - 18,
      this.itemViewport.hasPrevious(),
      this.itemViewport.hasNext(entries.length),
    );

    context.restore();
  }

  drawArrangeOverlay(context, columns) {
    if (this.focusArea !== Window_Inventory.FOCUS.ARRANGE) {
      return;
    }

    const options = this.arrangeOptions();
    const overlayWidth = Math.min(
      280,
      Math.max(228, Math.floor(columns.rightWidth * 0.42)),
    );
    const bounds = {
      x: Math.round(columns.rightX + (columns.rightWidth - overlayWidth) / 2),
      y: columns.tabBottom + 8,
      width: overlayWidth,
      height: 194,
    };

    this.drawPanel(context, bounds, { assetAlpha: 0.72 });

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 15px sans-serif";
    context.fillText("SORT ORDER", bounds.x + 16, bounds.y + 22);

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 14, bounds.y + 40);
    context.lineTo(bounds.x + bounds.width - 14, bounds.y + 40);
    context.stroke();

    const firstY = bounds.y + 64;
    const rowHeight = 30;

    options.forEach((option, index) => {
      const y = firstY + index * rowHeight;
      const focused = index === this.arrangeIndex;
      const applied = option.mode === this.sortMode;

      if (focused) {
        this.drawSelection(
          context,
          bounds.x + 8,
          y - 13,
          bounds.width - 16,
          27,
        );
      }

      this.drawRowMarker(
        context,
        focused ? "▶" : "",
        bounds.x + 18,
        y,
        focused ? "#ffd75a" : "#7ff0d5",
      );
      context.fillStyle = focused
        ? "#ffd75a"
        : applied
          ? "#7ff0d5"
          : "#ffffff";
      context.font = focused ? "600 16px sans-serif" : "16px sans-serif";
      context.fillText(
        `${option.label}${applied ? "  ✓" : ""}`,
        bounds.x + 40,
        y,
      );
    });

    context.restore();
  }

  drawArrangePage(context, columns) {
    const previewMode = this.focusArea === Window_Inventory.FOCUS.ARRANGE
      ? this.currentArrangeOption()?.mode || this.sortMode
      : this.sortMode;
    const previewEntries = this.inventoryDisplayEntries(previewMode);
    const rhythm = this.contentRhythm(columns);

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("PREVIEW", columns.rightX + 6, rhythm.headingY);

    if (previewEntries.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText(
        "No usable items owned.",
        columns.rightX + 12,
        rhythm.emptyY,
      );
      context.restore();
      this.drawArrangeOverlay(context, columns);
      return;
    }

    const row = this.contentRowGeometry(columns);
    const previewVisible = Math.max(
      5,
      Math.min(
        11,
        Math.floor((columns.rightBodyHeight - 34) / row.rowHeight),
      ),
    );

    previewEntries.slice(0, previewVisible).forEach((entry, index) => {
      const y = row.firstRowY + index * row.rowHeight;
      const disabled = entry?.usable === false;
      const typeTag = disabled
        ? ` [${entry.type === "accessory" ? "ACC" : entry.type.toUpperCase()}]`
        : "";
      context.fillStyle = disabled ? "#6f7d92" : "#ffffff";
      context.font = "17px sans-serif";
      context.fillText(
        `${entry?.record?.name || `Item ${entry?.id}`}${typeTag}`,
        row.textX,
        y,
      );
      context.textAlign = "right";
      context.fillText(`x${entry?.quantity ?? 0}`, row.quantityX, y);
      context.textAlign = "left";
    });

    this.drawScrollIndicators(
      context,
      columns.rightX + columns.rightWidth - 2,
      rhythm.scrollTopY,
      columns.rightBodyY + columns.rightBodyHeight - 18,
      false,
      previewEntries.length > previewVisible,
    );

    context.restore();
    this.drawArrangeOverlay(context, columns);
  }

  drawKeyItemsPage(context, columns) {
    const itemIds = this.keyItemIds();
    const rhythm = this.contentRhythm(columns);

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("KEY ITEMS", columns.rightX + 6, rhythm.headingY);

    if (itemIds.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText(
        "No key items owned.",
        columns.rightX + 12,
        rhythm.emptyY,
      );
      context.restore();
      return;
    }

    const rowsPerColumn = this.keyVisibleRows();
    const columnGap = 20;
    const columnWidth = Math.floor((columns.rightWidth - columnGap) / 2);
    const start = this.keyItemViewport.offset;
    const visible = itemIds.slice(start, start + rowsPerColumn * 2);
    const rowGeometry = this.contentRowGeometry(columns, {
      x: columns.rightX,
      width: columnWidth,
    });

    visible.forEach((itemId, visibleIndex) => {
      const item = this.itemRecord(itemId);
      const absoluteIndex = start + visibleIndex;
      const column = Math.floor(visibleIndex / rowsPerColumn);
      const rowIndex = visibleIndex % rowsPerColumn;
      const x = columns.rightX + column * (columnWidth + columnGap);
      const columnRow = this.contentRowGeometry(columns, {
        x,
        width: columnWidth,
      });
      const y = rowGeometry.firstRowY + rowIndex * rowGeometry.rowHeight;
      const focused =
        this.focusArea === Window_Inventory.FOCUS.KEY_ITEMS &&
        absoluteIndex === this.keyItemIndex;

      if (focused) {
        this.drawSelection(context, x + 4, y - 16, columnWidth - 8, 30);
      }

      context.fillStyle = focused
        ? (typeof UIThemePalette !== "undefined" ? UIThemePalette.focus() : "#ffd75a")
        : (typeof UIThemePalette !== "undefined" ? UIThemePalette.keyItem() : "#ff9ed8");
      context.font = focused ? "600 17px sans-serif" : "17px sans-serif";
      this.drawRowMarker(
        context,
        focused ? "▶" : "",
        columnRow.cursorX,
        y,
      );
      context.fillText(
        item?.name || `Item ${itemId}`,
        columnRow.textX,
        y,
      );
    });

    this.drawScrollIndicators(
      context,
      columns.rightX + columns.rightWidth - 8,
      rhythm.scrollTopY,
      columns.rightBodyY + columns.rightBodyHeight - 18,
      this.keyItemViewport.hasPrevious(),
      this.keyItemViewport.hasNext(itemIds.length),
    );
    context.restore();
  }

  drawContent(context) {
    const bounds = this.contentBounds;
    const columns = this.contentColumns(bounds);
    this.drawPanel(context, bounds);
    this.drawContentDivider(context, columns);
    this.drawTabs(context, columns);
    this.drawPartyRoster(context, columns);

    if (this.pageIndex === 0) {
      this.drawUsePage(context, columns);
    } else if (this.pageIndex === 1) {
      this.drawArrangePage(context, columns);
    } else {
      this.drawKeyItemsPage(context, columns);
    }
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    context.save();

    this.drawPartyInventoryPanel(context);
    this.drawInfoPanel(context);
    this.drawDescription(context);
    this.drawContent(context);

    context.restore();
  }
}
