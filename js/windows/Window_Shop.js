"use strict";

class Window_Shop {
  static STATE = Object.freeze({
    COMMAND: "command",
    BUY: "buy",
    SELL: "sell",
    QUANTITY: "quantity",
  });

  constructor(shopData = {}) {
    this.title = shopData.name || "Shop";
    this.goods = Array.isArray(shopData.goods) ? shopData.goods : [];
    this.commandIndex = 0;
    this.buyIndex = 0;
    this.sellIndex = 0;
    this.quantity = 1;
    this.result = null;
    this.message = "";
    this.state = Window_Shop.STATE.COMMAND;

    this.width = Math.min(1260, Graphics.width - 24);
    this.height = Math.min(700, Graphics.height - 24);
    this.padding = 16;

    this.buyViewport = new Window_ListViewport(9);
    this.sellViewport = new Window_ListViewport(10);

    this.x = Math.floor((Graphics.width - this.width) / 2);
    this.y = Math.floor((Graphics.height - this.height) / 2);
  }

  // ==============================
  // Input / State Helpers
  // ==============================

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

  entries() {
    return this.goods
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
      .filter((entry) => entry !== null);
  }

  currentEntry() {
    const entries = this.entries();
    this.buyIndex = Math.max(0, Math.min(this.buyIndex, Math.max(0, entries.length - 1)));
    return entries[this.buyIndex] || null;
  }

  orderedSellEntries() {
    const groups = ["item", "weapon", "armor", "accessory"];
    const entries = [];

    for (const type of groups) {
      const source = Object.keys($gameParty?.[
        type === "item"
          ? "items"
          : type === "weapon"
            ? "weapons"
            : type === "armor"
              ? "armors"
              : "accessories"
      ] || {})
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
        .sort((a, b) => a - b);

      for (const id of source) {
        const owned = $gameParty?.merchandiseCount?.(type, id) || 0;
        if (owned <= 0) {
          continue;
        }

        const data = $gameParty?.merchandiseRecord?.(type, id) || null;
        if (!data) {
          continue;
        }

        entries.push({
          type,
          id,
          data,
          name: data.name,
          price: Number(data.price) || 0,
          owned,
          sellPrice: this.sellPrice(type, id),
        });
      }
    }

    return entries;
  }

  currentSellEntry() {
    const entries = this.orderedSellEntries();
    this.sellIndex = Math.max(0, Math.min(this.sellIndex, Math.max(0, entries.length - 1)));
    return entries[this.sellIndex] || null;
  }

  selectedEntry() {
    if (this.state === Window_Shop.STATE.SELL) {
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
    const record = $gameParty?.merchandiseRecord?.(type, id);
    const basePrice = Number(record?.price) || 0;
    return Math.max(0, Math.floor(basePrice / 2));
  }

  buyQuantityMax(entry = this.currentEntry()) {
    if (!entry) {
      return 0;
    }

    const price = Math.max(0, Number(entry.price) || 0);
    if (price <= 0) {
      return 99;
    }

    const gil = Math.max(0, Number($gameParty?.gil?.() || 0));
    return Math.max(0, Math.min(99, Math.floor(gil / price)));
  }

  merchantTypes() {
    return [...new Set(this.entries().map((entry) => entry.type))];
  }

  equippedCount(type, id) {
    const members = this.partyMembers();
    let count = 0;

    members.forEach((actor) => {
      if (!actor) {
        return;
      }

      if (type === "weapon" && Number(actor.weaponId) === Number(id)) {
        count += 1;
      }

      if (type === "armor" && Number(actor.armorId) === Number(id)) {
        count += 1;
      }

      if (type === "accessory" && Number(actor.accessoryId) === Number(id)) {
        count += 1;
      }
    });

    return count;
  }

  currentPrompt() {
    switch (this.state) {
      case Window_Shop.STATE.BUY:
        return "What would you like to buy?";
      case Window_Shop.STATE.QUANTITY:
        return "How many would you like?";
      case Window_Shop.STATE.SELL:
        return "What would you like to sell?";
      default:
        return "Welcome!";
    }
  }

  currentDescription() {
    const entry = this.selectedEntry();

    if (this.message) {
      return this.message;
    }

    if (this.state === Window_Shop.STATE.COMMAND) {
      switch (this.currentCommand()) {
        case "Buy":
          return "Browse this merchant's wares and confirm how many you want before spending any Runes.";
        case "Sell":
          return "Sell extra inventory in stable party order. Item lists respect the same ordering used in the party Item menu.";
        default:
          return "Leave the shop and return to the field.";
      }
    }

    if (!entry) {
      return this.state === Window_Shop.STATE.SELL
        ? "No saleable merchandise owned."
        : "No merchandise available.";
    }

    return entry.data?.description || "No description available.";
  }

  // ==============================
  // Update
  // ==============================

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
      this.commandIndex = (this.commandIndex - 1 + this.commands().length) % this.commands().length;
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

    if (command === "Buy") {
      this.state = Window_Shop.STATE.BUY;
      this.message = "";
      return;
    }

    if (command === "Sell") {
      this.state = Window_Shop.STATE.SELL;
      this.message = "";
    }
  }

  updateBuy() {
    const entries = this.entries();

    if (this.actionTriggered("cancel")) {
      this.state = Window_Shop.STATE.COMMAND;
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
      this.buyViewport.ensureVisible(this.buyIndex, entries.length);
      return;
    }

    const entry = this.currentEntry();
    if (!entry) {
      return;
    }

    const max = this.buyQuantityMax(entry);
    if (max <= 0) {
      this.message = `Not enough Runes. Need ${entry.price}, have ${$gameParty?.gil?.() ?? 0}.`;
      return;
    }

    this.quantity = Math.max(1, Math.min(max, this.quantity || 1));
    this.state = Window_Shop.STATE.QUANTITY;
  }

  updateQuantity() {
    const entry = this.currentEntry();
    const max = this.buyQuantityMax(entry);

    if (!entry || max <= 0) {
      this.state = Window_Shop.STATE.BUY;
      this.quantity = 1;
      return;
    }

    if (this.actionTriggered("cancel")) {
      this.state = Window_Shop.STATE.BUY;
      this.quantity = 1;
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

    if (this.actionTriggered("confirm")) {
      this.result = {
        action: "purchase",
        type: entry.type,
        id: entry.id,
        quantity: this.quantity,
      };
      this.quantity = 1;
      this.state = Window_Shop.STATE.BUY;
    }
  }

  updateSell() {
    const entries = this.orderedSellEntries();

    if (this.actionTriggered("cancel")) {
      this.state = Window_Shop.STATE.COMMAND;
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
      if (entry) {
        this.result = {
          action: "sell",
          type: entry.type,
          id: entry.id,
          quantity: 1,
        };
      }
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

  // ==============================
  // Drawing Helpers
  // ==============================

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

  drawPortraitPlaceholder(context, actor, x, y, size) {
    if (
      typeof Window_ActorSummary !== "undefined" &&
      typeof Window_ActorSummary.drawPortraitPlaceholder === "function"
    ) {
      Window_ActorSummary.drawPortraitPlaceholder(context, actor, x, y, size);
      return;
    }

    const initial = String(actor?.name || "?").trim().charAt(0).toUpperCase() || "?";
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
    const paddingX = Number(options.paddingX) || 18;
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

  headerBounds() {
    const titleWidth = Math.min(300, Math.floor(this.width * 0.24));
    const gap = 8;
    const topHeight = 68;
    const prompt = {
      x: this.x,
      y: this.y,
      width: this.width - titleWidth - gap,
      height: topHeight,
    };
    const title = {
      x: prompt.x + prompt.width + gap,
      y: this.y,
      width: titleWidth,
      height: topHeight,
    };

    return { prompt, title, gap, topHeight };
  }

  bodyTopY() {
    return this.y + 76;
  }

  drawHeader(context) {
    const header = this.headerBounds();
    this.drawPanel(context, header.prompt);
    this.drawPanel(context, header.title);

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "600 24px sans-serif";
    context.fillText(this.currentPrompt(), header.prompt.x + 18, header.prompt.y + header.prompt.height / 2);

    context.textAlign = "center";
    context.font = "600 20px sans-serif";
    context.fillText(this.title, header.title.x + header.title.width / 2, header.title.y + header.title.height / 2);
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

  drawBackground(context) {
    context.save();
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    context.restore();
  }

  drawCommandState(context) {
    const top = this.bodyTopY();
    const descriptionBounds = {
      x: this.x,
      y: top,
      width: this.width,
      height: 58,
    };
    const contentY = descriptionBounds.y + descriptionBounds.height + 8;
    const leftWidth = Math.floor(this.width * 0.68);
    const gap = 8;
    const leftBounds = {
      x: this.x,
      y: contentY,
      width: leftWidth,
      height: this.height - (contentY - this.y),
    };
    const rightBounds = {
      x: leftBounds.x + leftBounds.width + gap,
      y: contentY,
      width: this.width - leftBounds.width - gap,
      height: leftBounds.height,
    };

    this.drawPanel(context, descriptionBounds, { assetAlpha: 0.46 });
    this.drawDescriptionText(context, descriptionBounds, this.currentDescription());
    this.drawPanel(context, leftBounds);
    this.drawPanel(context, rightBounds);

    const commands = this.commands();
    const commandGap = 12;
    const commandWidth = Math.floor((leftBounds.width - 42 - commandGap * (commands.length - 1)) / commands.length);
    const commandHeight = 40;
    const commandY = leftBounds.y + 22;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";

    commands.forEach((command, index) => {
      const commandX = leftBounds.x + 18 + index * (commandWidth + commandGap);
      const selected = index === this.commandIndex;
      if (selected) {
        this.drawSelection(context, commandX, commandY, commandWidth, commandHeight);
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.font = selected ? "600 18px sans-serif" : "18px sans-serif";
      context.fillText(`${selected ? "▶ " : "  "}${command}`, commandX + 12, commandY + commandHeight / 2);
    });

    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("MERCHANDISE", leftBounds.x + 18, leftBounds.y + 92);

    context.strokeStyle = "rgba(210, 222, 242, 0.28)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(leftBounds.x + 18, leftBounds.y + 108);
    context.lineTo(leftBounds.x + leftBounds.width - 18, leftBounds.y + 108);
    context.stroke();

    const previewEntries = this.entries().slice(0, 8);
    if (previewEntries.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("This merchant is still stocking the shelves.", leftBounds.x + 18, leftBounds.y + 148);
    } else {
      context.font = "16px sans-serif";
      previewEntries.forEach((entry, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const textX = leftBounds.x + 18 + column * Math.floor((leftBounds.width - 36) / 2);
        const textY = leftBounds.y + 146 + row * 34;
        context.fillStyle = "#aebbd0";
        context.fillText(`[${this.typeLabel(entry.type)}]`, textX, textY);
        context.fillStyle = "#ffffff";
        context.fillText(entry.name, textX + 72, textY);
      });
    }

    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("OVERVIEW", rightBounds.x + 18, rightBounds.y + 30);

    const merchantTypes = this.merchantTypes();
    const overviewRows = [
      ["Runes", String($gameParty?.gil?.() ?? 0)],
      ["Goods", String(this.entries().length)],
      ["Types", merchantTypes.map((type) => this.typeLabel(type)).join(", ") || "—"],
      ["Buy", "Browse and confirm quantity"],
      ["Sell", "Stable two-column inventory"],
    ];

    context.fillStyle = "#ffffff";
    context.font = "15px sans-serif";
    context.fillText(`Runes: ${$gameParty?.gil?.() ?? 0}`, rightBounds.x + 18, rightBounds.y + 54);

    overviewRows.forEach(([label, value], index) => {
      const y = rightBounds.y + 94 + index * 34;
      context.fillStyle = "#aebbd0";
      context.font = "15px sans-serif";
      context.fillText(label, rightBounds.x + 18, y);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.fillText(String(value), rightBounds.x + rightBounds.width - 18, y);
      context.textAlign = "left";
    });

    context.restore();
  }

  drawBuyState(context) {
    const descriptionBounds = {
      x: this.x,
      y: this.bodyTopY(),
      width: this.width,
      height: 58,
    };
    const topY = descriptionBounds.y + descriptionBounds.height + 8;
    const mainHeight = 252;
    const listWidth = Math.floor(this.width * 0.63);
    const gap = 8;
    const listBounds = {
      x: this.x,
      y: topY,
      width: listWidth,
      height: mainHeight,
    };
    const infoBounds = {
      x: listBounds.x + listBounds.width + gap,
      y: topY,
      width: this.width - listWidth - gap,
      height: mainHeight,
    };
    const previewBounds = {
      x: this.x,
      y: topY + mainHeight + gap,
      width: this.width,
      height: this.y + this.height - (topY + mainHeight + gap),
    };
    const entry = this.currentEntry();
    const entries = this.entries();

    this.drawPanel(context, descriptionBounds, { assetAlpha: 0.46 });
    this.drawDescriptionText(context, descriptionBounds, this.currentDescription());
    this.drawPanel(context, listBounds);
    this.drawPanel(context, infoBounds);
    this.drawPanel(context, previewBounds);

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("BUY", listBounds.x + 18, listBounds.y + 28);

    if (entries.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No merchandise available.", listBounds.x + 18, listBounds.y + 74);
    } else {
      const rowHeight = 28;
      const listTop = listBounds.y + 74;
      this.buyViewport.ensureVisible(this.buyIndex, entries.length);
      const range = this.buyViewport.visibleRange(this.buyIndex, entries.length);

      for (let i = range.start; i < range.end; i++) {
        const current = entries[i];
        const y = listTop + (i - range.start) * rowHeight;
        const selected = i === this.buyIndex;

        if (selected) {
          this.drawSelection(context, listBounds.x + 12, y - 14, listBounds.width - 24, 28);
        }

        context.fillStyle = selected ? "#ffd75a" : "#ffffff";
        context.font = selected ? "600 18px sans-serif" : "18px sans-serif";
        context.fillText(`${selected ? "▶ " : "  "}${current.name}`, listBounds.x + 18, y);

        context.textAlign = "right";
        context.fillStyle = "#ffffff";
        context.font = "17px sans-serif";
        context.fillText(String(current.price), listBounds.x + listBounds.width - 18, y);
        context.textAlign = "left";
      }

      this.drawScrollIndicators(
        context,
        listBounds.x + listBounds.width - 6,
        listBounds.y + 64,
        listBounds.y + listBounds.height - 18,
        this.buyViewport.hasPrevious(),
        this.buyViewport.hasNext(entries.length),
      );
    }

    const owned = entry ? ($gameParty?.merchandiseCount?.(entry.type, entry.id) || 0) : 0;
    const equipped = entry ? this.equippedCount(entry.type, entry.id) : 0;
    const infoRows = [
      ["Runes", String($gameParty?.gil?.() ?? 0)],
      ["Price", entry ? String(entry.price) : "—"],
      ["Owned", String(owned)],
      ["Equipped", String(equipped)],
    ];

    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("DETAILS", infoBounds.x + 18, infoBounds.y + 28);
    context.fillStyle = "#ffffff";
    context.font = "15px sans-serif";
    context.fillText(`Runes: ${$gameParty?.gil?.() ?? 0}`, infoBounds.x + 18, infoBounds.y + 54);

    infoRows.forEach(([label, value], index) => {
      const y = infoBounds.y + 92 + index * 42;
      context.fillStyle = label === "Runes" ? "#7ff0d5" : "#aebbd0";
      context.font = "16px sans-serif";
      context.fillText(label, infoBounds.x + 18, y);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.font = "600 18px sans-serif";
      context.fillText(value, infoBounds.x + infoBounds.width - 18, y);
      context.textAlign = "left";
    });

    if (entry && this.isEquipmentType(entry.type)) {
      this.drawEquipmentComparison(context, previewBounds, entry);
    } else {
      this.drawPartyPreview(context, previewBounds);
    }

    context.restore();

    if (this.state === Window_Shop.STATE.QUANTITY) {
      this.drawQuantityOverlay(context, entry);
    }
  }

  statDefinitionsForEntry(entry) {
    if (!entry || !this.isEquipmentType(entry.type)) {
      return [];
    }

    const accessory = (actor, override) => override || actor?.accessory?.() || null;
    const currentWeapon = (actor) => actor?.weapon?.() || null;
    const currentArmor = (actor) => actor?.armor?.() || null;

    const definitions = [
      {
        key: "atk",
        shortLabel: "ATK",
        current: (actor) => Number(actor?.totalAttack?.() || 0),
        preview: (actor) => {
          if (entry.type === "weapon") {
            return Number(actor?.attackWithWeapon?.(entry.data, accessory(actor)) || 0);
          }

          if (entry.type === "accessory") {
            return Number(actor?.attackWithWeapon?.(currentWeapon(actor), entry.data) || 0);
          }

          return Number(actor?.totalAttack?.() || 0);
        },
      },
      {
        key: "def",
        shortLabel: "DEF",
        current: (actor) => Number(actor?.totalDefense?.() || 0),
        preview: (actor) => {
          if (entry.type === "armor") {
            return Number(actor?.defenseWithArmor?.(entry.data, accessory(actor)) || 0);
          }

          if (entry.type === "accessory") {
            return Number(actor?.defenseWithArmor?.(currentArmor(actor), entry.data) || 0);
          }

          return Number(actor?.totalDefense?.() || 0);
        },
      },
      {
        key: "mat",
        shortLabel: "MAT",
        current: (actor) => Number(actor?.totalMagicAttack?.() || 0),
        preview: (actor) => {
          if (entry.type === "weapon") {
            return Number(actor?.magicAttackWithWeapon?.(entry.data, accessory(actor)) || 0);
          }

          if (entry.type === "accessory") {
            return Number(actor?.magicAttackWithWeapon?.(currentWeapon(actor), entry.data) || 0);
          }

          return Number(actor?.totalMagicAttack?.() || 0);
        },
      },
      {
        key: "mdf",
        shortLabel: "MDF",
        current: (actor) => Number(actor?.totalMagicDefense?.() || 0),
        preview: (actor) => {
          if (entry.type === "accessory") {
            return Number(actor?.magicDefenseWithAccessory?.(entry.data) || 0);
          }

          return Number(actor?.totalMagicDefense?.() || 0);
        },
      },
      {
        key: "crt",
        shortLabel: "CRT",
        current: (actor) => Number(actor?.totalCritical?.() || 0),
        preview: (actor) => {
          if (entry.type === "weapon") {
            return Number(actor?.criticalWithWeapon?.(entry.data, accessory(actor)) || 0);
          }

          if (entry.type === "accessory") {
            return Number(actor?.criticalWithWeapon?.(currentWeapon(actor), entry.data) || 0);
          }

          return Number(actor?.totalCritical?.() || 0);
        },
      },
    ];

    const changes = definitions.map((definition) => {
      const deltas = this.partyMembers().map((actor) => {
        const current = definition.current(actor);
        const preview = definition.preview(actor);
        return Math.abs(preview - current);
      });
      const maxDelta = Math.max(0, ...deltas);
      return { definition, maxDelta };
    });

    const changed = changes.filter((entryChange) => entryChange.maxDelta > 0);
    if (changed.length > 0) {
      return changed
        .sort((a, b) => b.maxDelta - a.maxDelta)
        .slice(0, 2)
        .map((entryChange) => entryChange.definition);
    }

    return definitions.slice(0, 2);
  }

  drawEquipmentComparison(context, bounds, entry) {
    const members = this.partyMembers();
    const stats = this.statDefinitionsForEntry(entry);
    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("ROSTER PREVIEW", bounds.x + 18, bounds.y + 28);

    if (members.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No roster members available.", bounds.x + 18, bounds.y + 66);
      context.restore();
      return;
    }

    const columns = members.length <= 2 ? members.length : 2;
    const rows = Math.ceil(members.length / columns);
    const gap = 10;
    const cardWidth = Math.floor((bounds.width - 36 - gap * (columns - 1)) / columns);
    const cardHeight = Math.max(88, Math.floor((bounds.height - 58 - gap * (rows - 1)) / rows));

    members.forEach((actor, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cardX = bounds.x + 18 + column * (cardWidth + gap);
      const cardY = bounds.y + 44 + row * (cardHeight + gap);
      const portraitSize = Math.min(54, cardHeight - 24);
      const portraitX = cardX + 12;
      const portraitY = cardY + Math.max(10, Math.floor((cardHeight - portraitSize) / 2));
      const textX = portraitX + portraitSize + 12;

      this.drawPanel(context, {
        x: cardX,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
      }, {
        assetAlpha: 0.34,
        fallbackStroke: "rgba(150, 176, 220, 0.46)",
      });

      this.drawPortraitPlaceholder(context, actor, portraitX, portraitY, portraitSize);

      context.fillStyle = "#ffffff";
      context.font = "600 16px sans-serif";
      context.fillText(actor?.name || "Unknown", textX, cardY + 20);

      stats.forEach((stat, statIndex) => {
        const current = stat.current(actor);
        const preview = stat.preview(actor);
        const y = cardY + 48 + statIndex * 22;
        const deltaColor = preview > current ? "#7dff8a" : preview < current ? "#ff6b6b" : "#ffffff";

        context.fillStyle = "#7ff0d5";
        context.font = "600 13px sans-serif";
        context.fillText(stat.shortLabel, textX, y);
        context.textAlign = "right";
        context.fillStyle = "#ffffff";
        context.font = "600 14px sans-serif";
        context.fillText(String(current), cardX + cardWidth - 84, y);
        context.textAlign = "center";
        context.fillStyle = preview === current ? "#aebbd0" : "#55e0c2";
        context.fillText("→", cardX + cardWidth - 64, y);
        context.textAlign = "right";
        context.fillStyle = deltaColor;
        context.fillText(String(preview), cardX + cardWidth - 18, y);
        context.textAlign = "left";
      });
    });

    context.restore();
  }

  drawPartyPreview(context, bounds) {
    const members = this.partyMembers();

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("PARTY", bounds.x + 18, bounds.y + 28);

    if (members.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No roster members available.", bounds.x + 18, bounds.y + 66);
      context.restore();
      return;
    }

    const columns = Math.min(4, Math.max(2, members.length));
    const rows = Math.ceil(members.length / columns);
    const gap = 18;
    const portraitSize = Math.min(72, Math.floor((bounds.height - 60 - gap * Math.max(0, rows - 1)) / rows));

    members.forEach((actor, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const slotWidth = Math.floor((bounds.width - 36) / columns);
      const centerX = bounds.x + 18 + column * slotWidth + slotWidth / 2;
      const portraitX = Math.floor(centerX - portraitSize / 2);
      const portraitY = bounds.y + 54 + row * (portraitSize + 40);
      this.drawPortraitPlaceholder(context, actor, portraitX, portraitY, portraitSize);
      context.fillStyle = "#ffffff";
      context.font = "15px sans-serif";
      context.textAlign = "center";
      context.fillText(actor?.name || "Unknown", centerX, portraitY + portraitSize + 18);
    });

    context.restore();
  }

  drawQuantityOverlay(context, entry) {
    if (!entry) {
      return;
    }

    const width = 320;
    const height = 138;
    const bounds = {
      x: Math.floor(this.x + (this.width - width) / 2),
      y: Math.floor(this.y + 160),
      width,
      height,
    };

    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.45)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.restore();

    this.drawPanel(context, bounds, { assetAlpha: 0.58 });

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("How many", bounds.x + 18, bounds.y + 42);
    context.fillText("Total", bounds.x + 18, bounds.y + 82);

    context.textAlign = "right";
    context.fillStyle = "#ffffff";
    context.font = "600 18px sans-serif";
    context.fillText(String(this.quantity), bounds.x + bounds.width - 18, bounds.y + 42);
    context.fillText(String(this.quantity * (Number(entry.price) || 0)), bounds.x + bounds.width - 18, bounds.y + 82);
    context.restore();
  }

  drawSellState(context) {
    const descriptionBounds = {
      x: this.x,
      y: this.bodyTopY(),
      width: this.width,
      height: 58,
    };
    const listBounds = {
      x: this.x,
      y: descriptionBounds.y + descriptionBounds.height + 8,
      width: this.width,
      height: this.y + this.height - (descriptionBounds.y + descriptionBounds.height + 8),
    };
    const entries = this.orderedSellEntries();
    const current = this.currentSellEntry();

    this.drawPanel(context, descriptionBounds, { assetAlpha: 0.46 });
    this.drawDescriptionText(context, descriptionBounds, this.currentDescription());
    this.drawPanel(context, listBounds);

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("SELL", listBounds.x + 18, listBounds.y + 28);

    if (entries.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "16px sans-serif";
      context.fillText("No saleable merchandise owned.", listBounds.x + 18, listBounds.y + 72);
      context.restore();
      return;
    }

    const columns = 2;
    const rowHeight = 34;
    const rowCount = Math.ceil(entries.length / columns);
    const listTop = listBounds.y + 72;
    const availableWidth = listBounds.width - 36;
    const columnWidth = Math.floor(availableWidth / columns);
    this.sellViewport.ensureVisible(Math.floor(this.sellIndex / 2), rowCount);
    const range = this.sellViewport.visibleRange(Math.floor(this.sellIndex / 2), rowCount);

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

        context.fillStyle = selected ? "#ffd75a" : "#ffffff";
        context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
        context.fillText(`${selected ? "▶ " : "  "}${entry.name}`, x, y);

        context.textAlign = "right";
        context.fillStyle = "#ffffff";
        context.font = "16px sans-serif";
        context.fillText(
          `x${entry.owned}`,
          x + columnWidth - 12,
          y,
        );
        context.textAlign = "left";
      }
    }

    context.fillStyle = "#aebbd0";
    context.font = "15px sans-serif";
    context.fillText(
      `Sell Price: ${current ? current.sellPrice : 0} Runes`,
      listBounds.x + 18,
      listBounds.y + listBounds.height - 22,
    );

    this.drawScrollIndicators(
      context,
      listBounds.x + listBounds.width - 6,
      listBounds.y + 66,
      listBounds.y + listBounds.height - 42,
      this.sellViewport.hasPrevious(),
      this.sellViewport.hasNext(rowCount),
    );

    context.restore();
  }

  draw() {
    const context = Graphics.context;
    this.drawBackground(context);
    this.drawHeader(context);

    if (this.state === Window_Shop.STATE.SELL) {
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
