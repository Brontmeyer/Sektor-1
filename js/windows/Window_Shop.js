"use strict";

class Window_Shop {
  static STATE = Object.freeze({
    COMMAND: "command",
    BUY: "buy",
    SELL: "sell",
    QUANTITY: "quantity",
  });

  static QUANTITY_MODE = Object.freeze({
    BUY: "buy",
    SELL: "sell",
  });

  static SHOP_TYPES = Object.freeze({
    general: Object.freeze({
      label: "General Store",
      allowedTypes: Object.freeze(["item", "weapon", "armor", "accessory"]),
      greeting: "Welcome in. Buy what you need, sell what you can spare, and keep moving.",
    }),
    item: Object.freeze({
      label: "Item Store",
      allowedTypes: Object.freeze(["item"]),
      greeting: "Supplies, restoratives, and useful odds and ends for the journey.",
    }),
    weapon: Object.freeze({
      label: "Weapon Store",
      allowedTypes: Object.freeze(["weapon"]),
      greeting: "Weapons for the road ahead. Take your time and compare before you buy.",
    }),
    armor: Object.freeze({
      label: "Armor Store",
      allowedTypes: Object.freeze(["armor"]),
      greeting: "Protection matters. Compare the numbers and choose what keeps you standing.",
    }),
    accessory: Object.freeze({
      label: "Accessory Store",
      allowedTypes: Object.freeze(["accessory"]),
      greeting: "Small gear can make a big difference. Have a look around.",
    }),
  });

  constructor(shopData = {}) {
    this.title = shopData.name || "Shop";
    this.shopType = this.normalizeShopType(shopData.shopType);
    this.goods = Array.isArray(shopData.goods) ? shopData.goods : [];

    this.commandIndex = 0;
    this.buyIndex = 0;
    this.sellIndex = 0;
    this.quantity = 1;
    this.quantityMode = Window_Shop.QUANTITY_MODE.BUY;
    this.result = null;
    this.message = "";
    this.state = Window_Shop.STATE.COMMAND;

    this.width = Math.min(1260, Graphics.width - 24);
    this.height = Math.min(700, Graphics.height - 24);
    this.x = Math.floor((Graphics.width - this.width) / 2);
    this.y = Math.floor((Graphics.height - this.height) / 2);

    this.buyViewport = new Window_ListViewport(7);
    this.sellViewport = new Window_ListViewport(10);
  }

  // =====================================
  // Input / State
  // =====================================

  actionTriggered(action) {
    return typeof Input.isActionTriggered === "function"
      ? Input.isActionTriggered(action)
      : typeof Input.isTriggered === "function"
        ? Input.isTriggered(action)
        : false;
  }

  actionRepeated(action) {
    return typeof Input.isActionRepeated === "function"
      ? Input.isActionRepeated(action)
      : this.actionTriggered(action);
  }

  themeColor(role, fallback) {
    return typeof UIThemePalette !== "undefined"
      ? UIThemePalette.color(role, fallback)
      : fallback;
  }

  hasResult() {
    return this.result !== null;
  }

  takeResult() {
    const result = this.result;
    this.result = null;
    return result;
  }

  setMessage(message) {
    this.message = String(message || "");
  }

  commands() {
    return ["Buy", "Sell", "Exit"];
  }

  currentCommand() {
    return this.commands()[this.commandIndex] || "Buy";
  }

  partyMembers() {
    if (typeof $gameParty?.members === "function") {
      return $gameParty.members() || [];
    }

    if (typeof $gameParty?.battleFormationMembers === "function") {
      return $gameParty.battleFormationMembers() || [];
    }

    return [];
  }

  // =====================================
  // Shop Type
  // =====================================

  normalizeShopType(value) {
    const key = String(value || "general").trim().toLowerCase();
    return Object.hasOwn(Window_Shop.SHOP_TYPES, key) ? key : "general";
  }

  shopTypeConfig() {
    return Window_Shop.SHOP_TYPES[this.shopType] || Window_Shop.SHOP_TYPES.general;
  }

  shopAcceptsType(type) {
    return this.shopTypeConfig().allowedTypes.includes(type);
  }

  sellTypes() {
    return [...this.shopTypeConfig().allowedTypes];
  }

  // =====================================
  // Merchandise Data
  // =====================================

  entries() {
    return this.goods
      .filter((good) => this.shopAcceptsType(good?.type))
      .map((good) => {
        const data = $gameParty?.merchandiseRecord?.(good.type, good.id) || null;

        if (!data) {
          return null;
        }

        return {
          type: good.type,
          id: Number(good.id),
          data,
          name: data.name,
          price: Number(data.price) || 0,
          owned: $gameParty?.merchandiseCount?.(good.type, good.id) || 0,
        };
      })
      .filter(Boolean);
  }

  currentEntry() {
    const entries = this.entries();
    this.buyIndex = Math.max(
      0,
      Math.min(this.buyIndex, Math.max(0, entries.length - 1)),
    );
    return entries[this.buyIndex] || null;
  }

  inventoryIdsForType(type) {
    const stores = {
      item: "items",
      weapon: "weapons",
      armor: "armors",
      accessory: "accessories",
    };
    const store = stores[type];

    if (!store) {
      return [];
    }

    return Object.keys($gameParty?.[store] || {})
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
      .sort((a, b) => a - b);
  }

  sellableCount(type, id) {
    if (typeof $gameParty?.sellableMerchandiseCount === "function") {
      return Math.max(0, Number($gameParty.sellableMerchandiseCount(type, id)) || 0);
    }

    return Math.max(0, Number($gameParty?.merchandiseCount?.(type, id)) || 0);
  }

  orderedSellEntries() {
    const groups = this.sellTypes();
    const entries = [];

    for (const type of groups) {
      for (const id of this.inventoryIdsForType(type)) {
        const data = $gameParty?.merchandiseRecord?.(type, id) || null;
        const available = this.sellableCount(type, id);

        if (!data || available <= 0 || data.sellable === false) {
          continue;
        }

        entries.push({
          type,
          id,
          data,
          name: data.name,
          price: Number(data.price) || 0,
          owned: $gameParty?.merchandiseCount?.(type, id) || 0,
          available,
          sellPrice: this.sellPrice(type, id),
        });
      }
    }

    return entries;
  }

  currentSellEntry() {
    const entries = this.orderedSellEntries();
    this.sellIndex = Math.max(
      0,
      Math.min(this.sellIndex, Math.max(0, entries.length - 1)),
    );
    return entries[this.sellIndex] || null;
  }

  selectedEntry() {
    if (
      this.state === Window_Shop.STATE.SELL ||
      (this.state === Window_Shop.STATE.QUANTITY &&
        this.quantityMode === Window_Shop.QUANTITY_MODE.SELL)
    ) {
      return this.currentSellEntry();
    }

    return this.currentEntry();
  }

  typeLabel(type) {
    return {
      item: "Item",
      weapon: "Weapon",
      armor: "Armor",
      accessory: "Accessory",
    }[type] || "Goods";
  }

  isEquipmentType(type) {
    return type === "weapon" || type === "armor" || type === "accessory";
  }

  sellPrice(type, id) {
    if (typeof $gameParty?.merchandiseSellPrice === "function") {
      return Math.max(0, Number($gameParty.merchandiseSellPrice(type, id)) || 0);
    }

    const record = $gameParty?.merchandiseRecord?.(type, id);
    return Math.max(0, Math.floor((Number(record?.price) || 0) / 2));
  }

  equippedCount(type, id) {
    if (typeof $gameParty?.equippedMerchandiseCount === "function") {
      return Math.max(0, Number($gameParty.equippedMerchandiseCount(type, id)) || 0);
    }

    let count = 0;

    for (const actor of this.partyMembers()) {
      if (type === "weapon" && Number(actor?.weaponId) === Number(id)) {
        count += 1;
      } else if (type === "armor" && Number(actor?.armorId) === Number(id)) {
        count += 1;
      } else if (type === "accessory" && Number(actor?.accessoryId) === Number(id)) {
        count += 1;
      }
    }

    return count;
  }

  buyQuantityMax(entry = this.currentEntry()) {
    if (!entry) {
      return 0;
    }

    const inventoryLimit =
      typeof $gameParty?.inventoryLimit === "function"
        ? $gameParty.inventoryLimit()
        : 99;
    const capacity =
      typeof $gameParty?.merchandiseCapacity === "function"
        ? $gameParty.merchandiseCapacity(entry.type, entry.id)
        : Math.max(0, inventoryLimit - (Number(entry.owned) || 0));
    const price = Math.max(0, Number(entry.price) || 0);

    if (capacity <= 0) {
      return 0;
    }

    if (price === 0) {
      return Math.min(inventoryLimit, capacity);
    }

    const runes = Math.max(0, Number($gameParty?.gil?.() || 0));
    return Math.max(
      0,
      Math.min(inventoryLimit, capacity, Math.floor(runes / price)),
    );
  }

  sellQuantityMax(entry = this.currentSellEntry()) {
    return entry ? Math.max(0, Number(entry.available) || 0) : 0;
  }

  quantityEntry() {
    return this.quantityMode === Window_Shop.QUANTITY_MODE.SELL
      ? this.currentSellEntry()
      : this.currentEntry();
  }

  quantityMax() {
    return this.quantityMode === Window_Shop.QUANTITY_MODE.SELL
      ? this.sellQuantityMax()
      : this.buyQuantityMax();
  }

  quantityUnitPrice() {
    const entry = this.quantityEntry();
    if (!entry) {
      return 0;
    }

    return this.quantityMode === Window_Shop.QUANTITY_MODE.SELL
      ? this.sellPrice(entry.type, entry.id)
      : Math.max(0, Number(entry.price) || 0);
  }

  merchantTypes() {
    return this.sellTypes();
  }

  merchantFocusLabel() {
    return this.shopTypeConfig().label;
  }

  merchantGreeting() {
    return this.shopTypeConfig().greeting;
  }

  currentPrompt() {
    if (this.state === Window_Shop.STATE.QUANTITY) {
      return this.quantityMode === Window_Shop.QUANTITY_MODE.SELL
        ? "How many would you like to sell?"
        : "How many would you like to buy?";
    }

    switch (this.state) {
      case Window_Shop.STATE.BUY:
        return "What would you like to buy?";
      case Window_Shop.STATE.SELL:
        return "What would you like to sell?";
      default:
        return "Welcome!";
    }
  }

  currentDescription() {
    if (this.message) {
      return this.message;
    }

    if (this.state === Window_Shop.STATE.COMMAND) {
      switch (this.currentCommand()) {
        case "Buy":
          return "Browse the shop inventory, compare gear across the roster, and confirm a quantity before spending Runes.";
        case "Sell":
          return "Sell available inventory. Equipped copies and records marked unsellable stay protected.";
        default:
          return "Leave the shop and return to the field.";
      }
    }

    const entry = this.selectedEntry();
    if (!entry) {
      return this.state === Window_Shop.STATE.SELL
        ? "No saleable merchandise owned."
        : "No merchandise available.";
    }

    return entry.data?.description || "No description available.";
  }

  // =====================================
  // Update
  // =====================================

  update() {
    if (this.result !== null) {
      return;
    }

    switch (this.state) {
      case Window_Shop.STATE.BUY:
        this.updateBuy();
        break;
      case Window_Shop.STATE.SELL:
        this.updateSell();
        break;
      case Window_Shop.STATE.QUANTITY:
        this.updateQuantity();
        break;
      default:
        this.updateCommand();
        break;
    }
  }

  updateCommand() {
    if (this.actionTriggered("cancel")) {
      this.result = { action: "cancel" };
      return;
    }

    if (this.actionTriggered("left")) {
      this.commandIndex =
        (this.commandIndex - 1 + this.commands().length) % this.commands().length;
      this.message = "";
      return;
    }

    if (this.actionTriggered("right")) {
      this.commandIndex = (this.commandIndex + 1) % this.commands().length;
      this.message = "";
      return;
    }

    if (!this.actionTriggered("confirm")) {
      return;
    }

    const command = this.currentCommand();

    if (command === "Exit") {
      this.result = { action: "cancel" };
      return;
    }

    this.message = "";
    this.state = command === "Sell" ? Window_Shop.STATE.SELL : Window_Shop.STATE.BUY;
  }

  updateBuy() {
    const entries = this.entries();

    if (this.actionTriggered("cancel")) {
      this.state = Window_Shop.STATE.COMMAND;
      this.message = "";
      return;
    }

    if (entries.length === 0) {
      return;
    }

    if (this.actionRepeated("up")) {
      this.buyIndex = (this.buyIndex - 1 + entries.length) % entries.length;
      this.buyViewport.ensureVisible(this.buyIndex, entries.length);
      this.message = "";
      return;
    }

    if (this.actionRepeated("down")) {
      this.buyIndex = (this.buyIndex + 1) % entries.length;
      this.buyViewport.ensureVisible(this.buyIndex, entries.length);
      this.message = "";
      return;
    }

    if (!this.actionTriggered("confirm")) {
      return;
    }

    const entry = this.currentEntry();
    const max = this.buyQuantityMax(entry);

    if (!entry) {
      return;
    }

    if (max <= 0) {
      const capacity =
        typeof $gameParty?.merchandiseCapacity === "function"
          ? $gameParty.merchandiseCapacity(entry.type, entry.id)
          : Math.max(0, 99 - (Number(entry.owned) || 0));

      this.message =
        capacity <= 0
          ? `${entry.name} is already at the inventory limit.`
          : `Not enough Runes. Need ${entry.price}, have ${$gameParty?.gil?.() ?? 0}.`;
      return;
    }

    this.quantityMode = Window_Shop.QUANTITY_MODE.BUY;
    this.quantity = 1;
    this.state = Window_Shop.STATE.QUANTITY;
  }

  updateSell() {
    const entries = this.orderedSellEntries();

    if (this.actionTriggered("cancel")) {
      this.state = Window_Shop.STATE.COMMAND;
      this.message = "";
      return;
    }

    if (entries.length === 0) {
      return;
    }

    const rowCount = Math.ceil(entries.length / 2);
    let row = Math.floor(this.sellIndex / 2);
    let column = this.sellIndex % 2;

    if (this.actionRepeated("up")) {
      row = (row - 1 + rowCount) % rowCount;
    } else if (this.actionRepeated("down")) {
      row = (row + 1) % rowCount;
    } else if (this.actionTriggered("left")) {
      column = column === 0 ? 1 : 0;
    } else if (this.actionTriggered("right")) {
      column = column === 1 ? 0 : 1;
    } else if (this.actionTriggered("confirm")) {
      const entry = this.currentSellEntry();
      const max = this.sellQuantityMax(entry);

      if (entry && max > 0) {
        this.quantityMode = Window_Shop.QUANTITY_MODE.SELL;
        this.quantity = 1;
        this.state = Window_Shop.STATE.QUANTITY;
        this.message = "";
      }
      return;
    } else {
      return;
    }

    let nextIndex = row * 2 + column;
    if (nextIndex >= entries.length) {
      nextIndex = entries.length - 1;
    }

    this.sellIndex = Math.max(0, nextIndex);
    this.sellViewport.ensureVisible(Math.floor(this.sellIndex / 2), rowCount);
    this.message = "";
  }

  updateQuantity() {
    const entry = this.quantityEntry();
    const max = this.quantityMax();
    const returnState =
      this.quantityMode === Window_Shop.QUANTITY_MODE.SELL
        ? Window_Shop.STATE.SELL
        : Window_Shop.STATE.BUY;

    if (!entry || max <= 0) {
      this.quantity = 1;
      this.state = returnState;
      return;
    }

    if (this.actionTriggered("cancel")) {
      this.quantity = 1;
      this.state = returnState;
      return;
    }

    if (this.actionRepeated("left")) {
      this.quantity = this.quantity <= 1 ? max : this.quantity - 1;
      return;
    }

    if (this.actionRepeated("right")) {
      this.quantity = this.quantity >= max ? 1 : this.quantity + 1;
      return;
    }

    if (this.actionRepeated("up")) {
      this.quantity = Math.min(max, this.quantity + 10);
      return;
    }

    if (this.actionRepeated("down")) {
      this.quantity = Math.max(1, this.quantity - 10);
      return;
    }

    if (!this.actionTriggered("confirm")) {
      return;
    }

    this.result = {
      action:
        this.quantityMode === Window_Shop.QUANTITY_MODE.SELL ? "sell" : "purchase",
      type: entry.type,
      id: entry.id,
      quantity: this.quantity,
    };
    this.quantity = 1;
    this.state = returnState;
  }

  // =====================================
  // Shared Drawing
  // =====================================

  drawPanel(context, bounds, options = {}) {
    if (
      typeof Window_ActorSummary !== "undefined" &&
      typeof Window_ActorSummary.drawPanel === "function"
    ) {
      return Window_ActorSummary.drawPanel(context, bounds, options);
    }

    context.fillStyle = options.fallbackFill || "rgba(11, 16, 28, 0.96)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = options.fallbackStroke || "rgba(150, 176, 220, 0.78)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  drawSelection(context, x, y, width, height, options = {}) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawSelectionPanel === "function"
    ) {
      UIAssetManager.drawSelectionPanel(context, x, y, width, height, {
        alpha: 0.2,
        ...options,
      });
      return;
    }

    context.fillStyle = options.fallbackFill || "rgba(255, 215, 90, 0.12)";
    context.fillRect(x, y, width, height);
  }

  drawPortraitPlaceholder(context, subject, x, y, size) {
    if (
      typeof Window_ActorSummary !== "undefined" &&
      typeof Window_ActorSummary.drawPortraitPlaceholder === "function"
    ) {
      Window_ActorSummary.drawPortraitPlaceholder(context, subject, x, y, size);
      return;
    }

    const initial = String(subject?.name || "?").trim().charAt(0).toUpperCase() || "?";
    context.fillStyle = "rgba(12, 23, 45, 0.94)";
    context.fillRect(x, y, size, size);
    context.strokeStyle = "rgba(137, 182, 235, 0.85)";
    context.lineWidth = 1.5;
    context.strokeRect(x, y, size, size);
    context.fillStyle = "#f3f7fc";
    context.font = `600 ${Math.max(24, Math.floor(size * 0.4))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initial, x + size / 2, y + size / 2);
  }

  drawDescriptionText(context, bounds, text, options = {}) {
    const requestedPadding = Number(options.paddingX);
    const paddingX = Number.isFinite(requestedPadding) ? requestedPadding : 18;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = options.color || "#ffffff";
    context.font = options.font || "16px sans-serif";

    if (
      typeof Window_TextLayout !== "undefined" &&
      typeof Window_TextLayout.drawWrappedTextCentered === "function"
    ) {
      Window_TextLayout.drawWrappedTextCentered(
        context,
        text,
        bounds.x + paddingX,
        bounds.y + bounds.height / 2,
        bounds.width - paddingX * 2,
        options.lineHeight || 18,
        options.maxLines || 2,
      );
    } else {
      context.fillText(text, bounds.x + paddingX, bounds.y + bounds.height / 2);
    }

    context.restore();
  }

  drawBackground(context) {
    context.save();
    context.fillStyle = this.themeColor("backdrop", "#0b0e13");
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    context.restore();
  }

  headerBounds() {
    const gap = 8;
    const height = 68;
    const titleWidth = Math.min(300, Math.floor(this.width * 0.24));
    const prompt = {
      x: this.x,
      y: this.y,
      width: this.width - titleWidth - gap,
      height,
    };
    const title = {
      x: prompt.x + prompt.width + gap,
      y: this.y,
      width: titleWidth,
      height,
    };

    return { prompt, title };
  }

  bodyTopY() {
    return this.y + 76;
  }

  drawHeader(context) {
    const { prompt, title } = this.headerBounds();
    this.drawPanel(context, prompt);
    this.drawPanel(context, title);

    context.save();
    context.textBaseline = "middle";
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.primary()
      : "#ffffff";
    context.font = "600 24px sans-serif";
    context.textAlign = "left";
    context.fillText(this.currentPrompt(), prompt.x + 18, prompt.y + prompt.height / 2);

    context.font = "600 20px sans-serif";
    context.textAlign = "center";
    context.fillText(this.title, title.x + title.width / 2, title.y + title.height / 2);
    context.restore();
  }

  drawDescriptionStrip(context) {
    const bounds = {
      x: this.x,
      y: this.bodyTopY(),
      width: this.width,
      height: 58,
    };
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });
    this.drawDescriptionText(context, bounds, this.currentDescription());
    return bounds;
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

  // =====================================
  // Welcome / Command
  // =====================================

  drawCommandState(context) {
    const description = this.drawDescriptionStrip(context);
    const gap = 8;
    const contentY = description.y + description.height + gap;
    const contentHeight = this.y + this.height - contentY;
    const leftWidth = Math.floor((this.width - gap) * 0.66);
    const left = {
      x: this.x,
      y: contentY,
      width: leftWidth,
      height: contentHeight,
    };
    const right = {
      x: left.x + left.width + gap,
      y: contentY,
      width: this.width - left.width - gap,
      height: contentHeight,
    };

    this.drawPanel(context, left);
    this.drawPanel(context, right);

    const commands = this.commands();
    const commandGap = 12;
    const commandWidth = Math.floor(
      (left.width - 36 - commandGap * (commands.length - 1)) / commands.length,
    );
    const commandY = left.y + 20;
    const commandHeight = 42;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";

    commands.forEach((command, index) => {
      const x = left.x + 18 + index * (commandWidth + commandGap);
      const selected = index === this.commandIndex;

      if (selected) {
        this.drawSelection(context, x, commandY, commandWidth, commandHeight);
      }

      context.fillStyle = selected ? this.themeColor("focus", "#ffd75a") : "#ffffff";
      context.font = selected ? "600 18px sans-serif" : "18px sans-serif";
      context.fillText(
        `${selected ? "▶ " : "  "}${command}`,
        x + 12,
        commandY + commandHeight / 2,
      );
    });

    const portraitSize = Math.min(172, Math.floor(left.height * 0.42));
    const portraitX = left.x + 38;
    const portraitY = left.y + 104;
    this.drawPortraitPlaceholder(
      context,
      { name: this.title || "Merchant" },
      portraitX,
      portraitY,
      portraitSize,
    );

    // Portrait rendering centers its glyph. Restore left alignment before the
    // merchant identity and visit metadata so headings do not drift into borders.
    context.textAlign = "left";
    const identityX = portraitX + portraitSize + 30;
    context.fillStyle = this.themeColor("accent", "#7ff0d5");
    context.font = "600 16px sans-serif";
    context.fillText("SHOPKEEPER", identityX, portraitY + 18);
    context.fillStyle = "#ffffff";
    context.font = "600 27px sans-serif";
    context.fillText(this.title, identityX, portraitY + 56);
    context.fillStyle = this.themeColor("focus", "#ffd75a");
    context.font = "600 17px sans-serif";
    context.fillText(this.merchantFocusLabel(), identityX, portraitY + 88);

    const greetingBounds = {
      x: identityX,
      y: portraitY + 110,
      width: left.x + left.width - identityX - 30,
      height: Math.max(70, portraitSize - 110),
    };
    this.drawDescriptionText(context, greetingBounds, this.merchantGreeting(), {
      paddingX: 0,
      font: "16px sans-serif",
      lineHeight: 22,
      maxLines: 4,
    });

    context.textAlign = "left";
    context.fillStyle = this.themeColor("accent", "#7ff0d5");
    context.font = "600 18px sans-serif";
    context.fillText("VISIT", right.x + 18, right.y + 30);

    const visitRows = [
      ["Runes", String($gameParty?.gil?.() ?? 0)],
      ["Store", this.merchantFocusLabel()],
      ["Buy", "Available"],
      ["Sell", "Available"],
    ];

    visitRows.forEach(([label, value], index) => {
      const y = right.y + 82 + index * 44;
      context.fillStyle = this.themeColor("secondary", "#aebbd0");
      context.font = "15px sans-serif";
      context.textAlign = "left";
      context.fillText(label, right.x + 18, y);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.fillText(String(value), right.x + right.width - 18, y);
    });

    context.restore();
  }

  // =====================================
  // Buy
  // =====================================

  buyLayout(descriptionBounds) {
    const gap = 8;
    const mainY = descriptionBounds.y + descriptionBounds.height + gap;
    const mainHeight = Math.min(274, Math.floor(this.height * 0.39));
    const listWidth = Math.floor((this.width - gap) * 0.63);
    const list = {
      x: this.x,
      y: mainY,
      width: listWidth,
      height: mainHeight,
    };
    const details = {
      x: list.x + list.width + gap,
      y: mainY,
      width: this.width - list.width - gap,
      height: mainHeight,
    };
    const preview = {
      x: this.x,
      y: mainY + mainHeight + gap,
      width: this.width,
      height: this.y + this.height - (mainY + mainHeight + gap),
    };

    return { list, details, preview };
  }

  drawBuyState(context) {
    const description = this.drawDescriptionStrip(context);
    const layout = this.buyLayout(description);
    const entries = this.entries();
    const entry = this.currentEntry();

    this.drawPanel(context, layout.list);
    this.drawPanel(context, layout.details);
    this.drawPanel(context, layout.preview);

    this.drawBuyList(context, layout.list, entries);
    this.drawBuyDetails(context, layout.details, entry);

    if (entry && this.isEquipmentType(entry.type)) {
      this.drawEquipmentComparison(context, layout.preview, entry);
    } else {
      this.drawPartyPortraits(context, layout.preview);
    }

    if (this.state === Window_Shop.STATE.QUANTITY) {
      this.drawQuantityOverlay(context);
    }
  }

  drawBuyList(context, bounds, entries) {
    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = this.themeColor("accent", "#7ff0d5");
    context.font = "600 18px sans-serif";
    context.fillText("BUY", bounds.x + 18, bounds.y + 28);

    if (entries.length === 0) {
      context.fillStyle = this.themeColor("muted", "#8897ac");
      context.font = "16px sans-serif";
      context.fillText("No merchandise available.", bounds.x + 18, bounds.y + 76);
      context.restore();
      return;
    }

    const rowHeight = 29;
    const listTop = bounds.y + 72;
    const availableHeight = bounds.height - 88;
    this.buyViewport.maxVisibleRows = Math.max(
      1,
      Math.floor(availableHeight / rowHeight),
    );
    this.buyViewport.ensureVisible(this.buyIndex, entries.length);
    const range = this.buyViewport.visibleRange(this.buyIndex, entries.length);

    for (let i = range.start; i < range.end; i++) {
      const entry = entries[i];
      const y = listTop + (i - range.start) * rowHeight;
      const selected = i === this.buyIndex;
      const enabled = this.buyQuantityMax(entry) > 0;

      if (selected) {
        this.drawSelection(context, bounds.x + 12, y - 14, bounds.width - 24, 28);
      }

      context.fillStyle = enabled
        ? selected
          ? this.themeColor("focus", "#ffd75a")
          : "#ffffff"
        : this.themeColor("muted", "#8897ac");
      context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(`${selected ? "▶ " : "  "}${entry.name}`, bounds.x + 18, y);

      context.textAlign = "right";
      context.fillStyle = enabled ? "#ffffff" : this.themeColor("muted", "#8897ac");
      context.font = "16px sans-serif";
      context.fillText(String(entry.price), bounds.x + bounds.width - 18, y);
      context.textAlign = "left";
    }

    this.drawScrollIndicators(
      context,
      bounds.x + bounds.width - 6,
      bounds.y + 62,
      bounds.y + bounds.height - 14,
      this.buyViewport.hasPrevious(),
      this.buyViewport.hasNext(entries.length),
    );

    context.restore();
  }

  drawBuyDetails(context, bounds, entry) {
    const runes = Math.max(0, Number($gameParty?.gil?.() || 0));
    const owned = entry
      ? Math.max(0, Number($gameParty?.merchandiseCount?.(entry.type, entry.id)) || 0)
      : 0;
    const equipped = entry ? this.equippedCount(entry.type, entry.id) : 0;

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = this.themeColor("accent", "#7ff0d5");
    context.font = "600 18px sans-serif";
    context.fillText("DETAILS", bounds.x + 18, bounds.y + 28);

    context.textAlign = "right";
    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "600 13px sans-serif";
    context.fillText(
      entry ? this.typeLabel(entry.type).toUpperCase() : "",
      bounds.x + bounds.width - 18,
      bounds.y + 28,
    );
    context.textAlign = "left";

    const rows = [
      ["Runes", String(runes), this.themeColor("accent", "#7ff0d5")],
      ["Price", entry ? String(entry.price) : "—", this.themeColor("secondary", "#aebbd0")],
      ["Owned", String(owned), this.themeColor("secondary", "#aebbd0")],
    ];

    if (entry && this.isEquipmentType(entry.type)) {
      rows.push(["Equipped", String(equipped), this.themeColor("secondary", "#aebbd0")]);
    }

    rows.forEach(([label, value, labelColor], index) => {
      const y = bounds.y + 80 + index * 46;
      context.fillStyle = labelColor;
      context.font = "16px sans-serif";
      context.fillText(label, bounds.x + 18, y);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.font = "600 18px sans-serif";
      context.fillText(value, bounds.x + bounds.width - 18, y);
      context.textAlign = "left";
    });

    context.restore();
  }

  statDefinitionsForEntry(entry) {
    if (!entry || !this.isEquipmentType(entry.type)) {
      return [];
    }

    const currentWeapon = (actor) => actor?.weapon?.() || null;
    const currentArmor = (actor) => actor?.armor?.() || null;
    const currentAccessory = (actor) => actor?.accessory?.() || null;

    const definitions = [
      {
        shortLabel: "ATK",
        current: (actor) => Number(actor?.totalAttack?.() || 0),
        preview: (actor) => {
          if (entry.type === "weapon") {
            return Number(actor?.attackWithWeapon?.(entry.data, currentAccessory(actor)) || 0);
          }
          if (entry.type === "accessory") {
            return Number(actor?.attackWithWeapon?.(currentWeapon(actor), entry.data) || 0);
          }
          return Number(actor?.totalAttack?.() || 0);
        },
      },
      {
        shortLabel: "DEF",
        current: (actor) => Number(actor?.totalDefense?.() || 0),
        preview: (actor) => {
          if (entry.type === "armor") {
            return Number(actor?.defenseWithArmor?.(entry.data, currentAccessory(actor)) || 0);
          }
          if (entry.type === "accessory") {
            return Number(actor?.defenseWithArmor?.(currentArmor(actor), entry.data) || 0);
          }
          return Number(actor?.totalDefense?.() || 0);
        },
      },
      {
        shortLabel: "MAT",
        current: (actor) => Number(actor?.totalMagicAttack?.() || 0),
        preview: (actor) => {
          if (entry.type === "weapon") {
            return Number(actor?.magicAttackWithWeapon?.(entry.data, currentAccessory(actor)) || 0);
          }
          if (entry.type === "accessory") {
            return Number(actor?.magicAttackWithWeapon?.(currentWeapon(actor), entry.data) || 0);
          }
          return Number(actor?.totalMagicAttack?.() || 0);
        },
      },
      {
        shortLabel: "MDF",
        current: (actor) => Number(actor?.totalMagicDefense?.() || 0),
        preview: (actor) =>
          entry.type === "accessory"
            ? Number(actor?.magicDefenseWithAccessory?.(entry.data) || 0)
            : Number(actor?.totalMagicDefense?.() || 0),
      },
      {
        shortLabel: "CRT",
        current: (actor) => Number(actor?.totalCritical?.() || 0),
        preview: (actor) => {
          if (entry.type === "weapon") {
            return Number(actor?.criticalWithWeapon?.(entry.data, currentAccessory(actor)) || 0);
          }
          if (entry.type === "accessory") {
            return Number(actor?.criticalWithWeapon?.(currentWeapon(actor), entry.data) || 0);
          }
          return Number(actor?.totalCritical?.() || 0);
        },
      },
    ];

    const scored = definitions.map((definition) => ({
      definition,
      maxDelta: Math.max(
        0,
        ...this.partyMembers().map((actor) =>
          Math.abs(definition.preview(actor) - definition.current(actor)),
        ),
      ),
    }));
    const changed = scored.filter((entryScore) => entryScore.maxDelta > 0);

    return (changed.length > 0 ? changed : scored)
      .sort((a, b) => b.maxDelta - a.maxDelta)
      .slice(0, 2)
      .map((entryScore) => entryScore.definition);
  }

  drawEquipmentComparison(context, bounds, entry) {
    const members = this.partyMembers();
    const stats = this.statDefinitionsForEntry(entry);

    if (members.length === 0) {
      this.drawDescriptionText(context, bounds, "No roster members available.", {
        color: this.themeColor("muted", "#8897ac"),
      });
      return;
    }

    const columns = members.length <= 2 ? members.length : 2;
    const rows = Math.ceil(members.length / columns);
    const gap = 10;
    const inset = 14;
    const cardWidth = Math.floor(
      (bounds.width - inset * 2 - gap * (columns - 1)) / columns,
    );
    const cardHeight = Math.floor(
      (bounds.height - inset * 2 - gap * (rows - 1)) / rows,
    );

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";

    members.forEach((actor, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const card = {
        x: bounds.x + inset + column * (cardWidth + gap),
        y: bounds.y + inset + row * (cardHeight + gap),
        width: cardWidth,
        height: cardHeight,
      };
      const portraitSize = Math.max(44, Math.min(58, card.height - 24));
      const portraitX = card.x + 12;
      const portraitY = card.y + Math.floor((card.height - portraitSize) / 2);
      const textX = portraitX + portraitSize + 12;

      this.drawPanel(context, card, {
        assetAlpha: 0.34,
        fallbackStroke: "rgba(150, 176, 220, 0.46)",
      });
      this.drawPortraitPlaceholder(context, actor, portraitX, portraitY, portraitSize);

      // Portrait rendering centers its glyph; reset the comparison text column so
      // the actor name and affected stat labels share the exact same left edge.
      context.textAlign = "left";
      context.fillStyle = "#ffffff";
      context.font = "600 16px sans-serif";
      context.fillText(actor?.name || "Unknown", textX, card.y + 20);

      stats.forEach((stat, statIndex) => {
        const current = stat.current(actor);
        const preview = stat.preview(actor);
        const y = card.y + 48 + statIndex * 22;
        const valueRight = card.x + card.width - 18;
        const arrowX = valueRight - 46;
        const currentX = arrowX - 20;

        context.fillStyle = this.themeColor("accent", "#7ff0d5");
        context.font = "600 13px sans-serif";
        context.textAlign = "left";
        context.fillText(stat.shortLabel, textX, y);

        context.fillStyle = "#ffffff";
        context.font = "600 14px sans-serif";
        context.textAlign = "right";
        context.fillText(String(current), currentX, y);

        context.fillStyle = preview === current ? this.themeColor("secondary", "#aebbd0") : "#55e0c2";
        context.textAlign = "center";
        context.fillText("→", arrowX, y);

        context.fillStyle =
          preview > current ? this.themeColor("positive", "#7dff8a") : preview < current ? this.themeColor("negative", "#ff6b6b") : "#ffffff";
        context.textAlign = "right";
        context.fillText(String(preview), valueRight, y);
      });
    });

    context.restore();
  }

  drawPartyPortraits(context, bounds) {
    const members = this.partyMembers();

    if (members.length === 0) {
      this.drawDescriptionText(context, bounds, "No roster members available.", {
        color: this.themeColor("muted", "#8897ac"),
      });
      return;
    }

    const columns = Math.min(4, Math.max(1, members.length));
    const slotWidth = (bounds.width - 36) / columns;
    const portraitSize = Math.max(58, Math.min(78, bounds.height - 70));

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "center";

    members.forEach((actor, index) => {
      const centerX = bounds.x + 18 + slotWidth * index + slotWidth / 2;
      const portraitX = Math.floor(centerX - portraitSize / 2);
      const blockHeight = portraitSize + 28;
      const portraitY = Math.floor(bounds.y + (bounds.height - blockHeight) / 2);
      this.drawPortraitPlaceholder(context, actor, portraitX, portraitY, portraitSize);
      context.fillStyle = "#ffffff";
      context.font = "15px sans-serif";
      context.fillText(actor?.name || "Unknown", centerX, portraitY + portraitSize + 20);
    });

    context.restore();
  }

  // =====================================
  // Sell
  // =====================================

  drawSellState(context) {
    const description = this.drawDescriptionStrip(context);
    const listBounds = {
      x: this.x,
      y: description.y + description.height + 8,
      width: this.width,
      height: this.y + this.height - (description.y + description.height + 8),
    };
    const entries = this.orderedSellEntries();

    this.drawPanel(context, listBounds);

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = this.themeColor("accent", "#7ff0d5");
    context.font = "600 18px sans-serif";
    context.fillText("SELL", listBounds.x + 18, listBounds.y + 28);

    if (entries.length === 0) {
      context.fillStyle = this.themeColor("muted", "#8897ac");
      context.font = "16px sans-serif";
      context.fillText("No saleable merchandise owned.", listBounds.x + 18, listBounds.y + 76);
      context.restore();
      return;
    }

    const columns = 2;
    const rowHeight = 34;
    const listTop = listBounds.y + 72;
    const availableHeight = listBounds.height - 92;
    const visibleRows = Math.max(1, Math.floor(availableHeight / rowHeight));
    const rowCount = Math.ceil(entries.length / columns);
    const columnWidth = Math.floor((listBounds.width - 36) / columns);

    this.sellViewport.maxVisibleRows = visibleRows;
    this.sellViewport.ensureVisible(Math.floor(this.sellIndex / 2), rowCount);
    const range = this.sellViewport.visibleRange(
      Math.floor(this.sellIndex / 2),
      rowCount,
    );

    for (let row = range.start; row < range.end; row++) {
      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        if (index >= entries.length) {
          continue;
        }

        const entry = entries[index];
        const x = listBounds.x + 18 + column * columnWidth;
        const y = listTop + (row - range.start) * rowHeight;
        const selected = index === this.sellIndex;

        if (selected) {
          this.drawSelection(context, x - 6, y - 14, columnWidth - 12, 28);
        }

        context.fillStyle = selected ? this.themeColor("focus", "#ffd75a") : "#ffffff";
        context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
        context.fillText(`${selected ? "▶ " : "  "}${entry.name}`, x, y);

        context.textAlign = "right";
        context.fillStyle = "#ffffff";
        context.font = "16px sans-serif";
        context.fillText(`x${entry.available}`, x + columnWidth - 12, y);
        context.textAlign = "left";
      }
    }

    this.drawScrollIndicators(
      context,
      listBounds.x + listBounds.width - 6,
      listBounds.y + 64,
      listBounds.y + listBounds.height - 18,
      this.sellViewport.hasPrevious(),
      this.sellViewport.hasNext(rowCount),
    );

    context.restore();

    if (this.state === Window_Shop.STATE.QUANTITY) {
      this.drawQuantityOverlay(context);
    }
  }

  // =====================================
  // Shared Quantity Overlay
  // =====================================

  drawQuantityOverlay(context) {
    const entry = this.quantityEntry();
    if (!entry) {
      return;
    }

    const sellMode = this.quantityMode === Window_Shop.QUANTITY_MODE.SELL;
    const width = 380;
    const height = 222;
    const bounds = {
      x: Math.floor(this.x + (this.width - width) / 2),
      y: Math.floor(this.y + (this.height - height) / 2),
      width,
      height,
    };
    const unitPrice = this.quantityUnitPrice();
    const max = this.quantityMax();
    const total = unitPrice * this.quantity;

    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.48)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.restore();

    this.drawPanel(context, bounds, { assetAlpha: 0.6 });

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.font = "600 20px sans-serif";
    context.fillText(entry.name, bounds.x + 18, bounds.y + 30);

    const rows = sellMode
      ? [
          ["Sell Price", `${unitPrice} Runes`],
          ["Available", `x${max}`],
          ["Quantity", String(this.quantity)],
          ["Receive", `${total} Runes`],
        ]
      : [
          ["Price", `${unitPrice} Runes`],
          ["Max", `x${max}`],
          ["Quantity", String(this.quantity)],
          ["Total", `${total} Runes`],
        ];

    rows.forEach(([label, value], index) => {
      const y = bounds.y + 70 + index * 34;
      context.fillStyle = index === rows.length - 1 ? this.themeColor("accent", "#7ff0d5") : this.themeColor("secondary", "#aebbd0");
      context.font = "16px sans-serif";
      context.textAlign = "left";
      context.fillText(label, bounds.x + 18, y);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.font = index === rows.length - 1 ? "600 18px sans-serif" : "16px sans-serif";
      context.fillText(value, bounds.x + bounds.width - 18, y);
    });

    context.restore();
  }

  draw() {
    const context = Graphics.context;
    this.drawBackground(context);
    this.drawHeader(context);

    if (
      this.state === Window_Shop.STATE.SELL ||
      (this.state === Window_Shop.STATE.QUANTITY &&
        this.quantityMode === Window_Shop.QUANTITY_MODE.SELL)
    ) {
      this.drawSellState(context);
      return;
    }

    if (
      this.state === Window_Shop.STATE.BUY ||
      this.state === Window_Shop.STATE.QUANTITY
    ) {
      this.drawBuyState(context);
      return;
    }

    this.drawCommandState(context);
  }
}
