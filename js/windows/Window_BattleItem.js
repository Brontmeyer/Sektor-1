"use strict";

class Window_BattleItem {
  constructor() {
    this.visible = false;
    this.index = 0;

    this.width = 360;
    this.height = 260;

    this.padding = 20;
    this.lineHeight = 40;

    this.x = 290;
    this.y = Graphics.height - this.height - 40;
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

  show() {
    this.visible = true;
    this.index = 0;
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
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

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const prefix = i === this.index ? "▶ " : "   ";
      const drawY = this.y + 75 + i * this.lineHeight;

      context.fillText(`${prefix}${item.name}`, this.x + this.padding, drawY);
      context.textAlign = "right";

      context.fillText(
        `x${$gameParty.itemCount(item.id)}`,
        this.x + this.width - this.padding,
        drawY,
      );

      context.textAlign = "left";
    }

    context.restore();
  }
}
