"use strict";

class Window_BattleItem {
  constructor() {
    this.visible = false;
    this.index = 0;

    this.width = 360;
    this.height = 260;

    this.padding = 20;
    this.lineHeight = 40;
    this.listViewport = new Window_ListViewport(5);

    this.x = 290;
    this.y = Graphics.height - this.height - 40;
  }

  update() {
    if (!this.visible) {
      return;
    }

    const items = this.items();

    if (items.length === 0) {
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = items.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= items.length) {
        this.index = 0;
      }
    }

    this.listViewport.ensureVisible(this.index, items.length);
  }

  items() {
    return $gameParty
      .itemIds()
      .map((itemId) => DatabaseManager.item(itemId))
      .filter((item) => item !== null);
  }

  currentItem() {
    const items = this.items();

    return items[this.index] || null;
  }

  show({ preserveIndex = false } = {}) {
    const entries = this.items();

    this.visible = true;

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
      context.fillText("▲", this.x + this.width - 8, this.y + 76);
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

    context.save();

    context.fillStyle = "rgba(0, 0, 0, 0.9)";

    context.fillRect(this.x, this.y, this.width, this.height);

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;

    context.strokeRect(this.x, this.y, this.width, this.height);

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = "22px Arial";
    context.fillStyle = "#ffffff";

    context.fillText("Items", this.x + this.padding, this.y + 30);

    if (items.length === 0) {
      context.fillText("(No items)", this.x + this.padding, this.y + 80);

      context.restore();
      return;
    }

    const range = this.listViewport.visibleRange(this.index, items.length);

    for (let i = range.start; i < range.end; i++) {
      const item = items[i];

      const prefix = i === this.index ? "▶ " : "   ";
      const visibleRow = i - range.start;
      const drawY = this.y + 75 + visibleRow * this.lineHeight;

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
