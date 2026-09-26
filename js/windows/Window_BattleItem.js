"use strict";

class Window_BattleItem {
  constructor(scene = null) {
    this.scene = scene;
    this.visible = false;
    this.index = 0;

    this.width = 360;
    this.height = 156;

    this.padding = 14;
    this.lineHeight = 32;
    this.listViewport = new Window_ListViewport(4);

    this.x = 290;
    this.y = Graphics.height - this.height - 40;
    this.refreshLayout();
  }

  refreshLayout() {
    const bounds = this.scene?.hudLayout?.selectorBounds?.() || null;
    const command = this.scene?.hudLayout?.commandBounds?.() || null;

    if (bounds) {
      this.x = bounds.x;
      this.y = bounds.y;
      this.width = bounds.width;
      this.height = bounds.height;
      return true;
    }

    if (!command) return false;

    this.x = command.x + command.width;
    this.y = command.y;
    this.width = 360;
    this.height = command.height;
    return true;
  }

  update() {
    if (!this.visible) {
      return;
    }

    const items = this.items();

    if (items.length === 0) {
      return;
    }

    if (Input.isActionTriggered("up")) {
      this.index = Math.max(0, this.index - 1);
    }

    if (Input.isActionTriggered("down")) {
      this.index = Math.min(items.length - 1, this.index + 1);
    }

    if (Input.isActionTriggered("left")) {
      this.index = this.listViewport.pageSelection(this.index, -1, items.length);
    }

    if (Input.isActionTriggered("right")) {
      this.index = this.listViewport.pageSelection(this.index, 1, items.length);
    }

    this.listViewport.ensureVisible(this.index, items.length);
  }

  items() {
    return $gameParty
      .itemIds()
      .map((itemId) => DatabaseManager.item(itemId))
      .filter(
        (item) =>
          item !== null &&
          item?.keyItem !== true &&
          item?.effect &&
          typeof item.effect.type === "string",
      );
  }

  currentItem() {
    const items = this.items();

    return items[this.index] || null;
  }

  currentDescription() {
    const entry = this.currentItem();
    return typeof entry?.description === "string" ? entry.description.trim() : "";
  }

  show({ preserveIndex = false } = {}) {
    const entries = this.items();

    this.visible = true;
    this.refreshLayout();

    if (!preserveIndex) {
      this.index = 0;
      this.listViewport.reset(this.index, entries.length);
      return;
    }

    this.index = Math.max(
      0,
      Math.min(this.index, Math.max(0, entries.length - 1)),
    );
    this.listViewport.ensureVisible(this.index, entries.length);
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  drawScrollIndicators(context, totalEntries) {
    context.save();
    context.fillStyle = "#ffffff";
    context.font = "16px Arial";
    context.textAlign = "right";

    if (this.listViewport.hasPrevious()) {
      context.fillText("▲", this.x + this.width - 8, this.y + 14);
    }

    if (this.listViewport.hasNext(totalEntries)) {
      context.fillText(
        "▼",
        this.x + this.width - 8,
        this.y + this.height - 10,
      );
    }

    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    const items = this.items();
    this.refreshLayout();

    context.save();

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        "battlePanel",
        this.x,
        this.y,
        this.width,
        this.height,
        {
          fallbackFill: "rgba(7, 10, 15, 0.84)",
          fallbackStroke: "rgba(151, 196, 229, 0.6)",
          lineWidth: 1.5,
          assetAlpha: 0.38,
          sourceMargin: 12,
          destMargin: 10,
        },
      );
    } else {
      context.fillStyle = "rgba(7, 10, 15, 0.84)";
      context.fillRect(this.x, this.y, this.width, this.height);
      context.strokeStyle = "rgba(151, 196, 229, 0.6)";
      context.lineWidth = 1.5;
      context.strokeRect(this.x, this.y, this.width, this.height);
    }

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = "19px Arial";
    context.fillStyle = "#ffffff";

    if (items.length === 0) {
      context.fillText("(No items)", this.x + this.padding, this.y + 28);

      context.restore();
      return;
    }

    const range = this.listViewport.visibleRange(this.index, items.length);

    for (let i = range.start; i < range.end; i++) {
      const item = items[i];

      const selected = i === this.index;
      const prefix = selected ? "▶ " : "   ";
      const visibleRow = i - range.start;
      const drawY = this.y + 24 + visibleRow * this.lineHeight;

      if (selected) {
        const drawn =
          typeof UIAssetManager !== "undefined" &&
          typeof UIAssetManager.drawSelectionPanel === "function" &&
          UIAssetManager.drawSelectionPanel(
            context,
            this.x + 10,
            drawY - this.lineHeight / 2 + 4,
            this.width - 20,
            this.lineHeight - 8,
            { alpha: 0.18 },
          );

        if (!drawn) {
          context.fillStyle = "rgba(255, 215, 90, 0.08)";
          context.fillRect(
            this.x + 10,
            drawY - this.lineHeight / 2 + 4,
            this.width - 20,
            this.lineHeight - 8,
          );
        }
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.fillText(`${prefix}${item.name}`, this.x + this.padding, drawY);
      context.textAlign = "right";

      context.fillText(
        `x${$gameParty.itemCount(item.id)}`,
        this.x + this.width - this.padding,
        drawY,
      );

      context.textAlign = "left";
    }

    this.drawScrollIndicators(context, items.length);

    context.restore();
  }
}
