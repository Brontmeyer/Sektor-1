"use strict";

class Window_Inventory {
  constructor(actor) {
    this.actor = actor;
    this.visible = false;

    this.index = 0;

    this.width = 500;
    this.height = 420;

    this.padding = 24;
    this.lineHeight = 40;
    this.listViewport = new Window_ListViewport(5);

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
  }

  update() {
    if (!this.visible) {
      return;
    }

    const itemIds = this.itemIds();

    if (Input.isActionTriggered("cancel")) {
      this.hide();

      return;
    }

    if (itemIds.length === 0) {
      return;
    }

    if (Input.isActionTriggered("up")) {
      this.index--;

      if (this.index < 0) {
        this.index = itemIds.length - 1;
      }
    }

    if (Input.isActionTriggered("down")) {
      this.index++;

      if (this.index >= itemIds.length) {
        this.index = 0;
      }
    }

    this.listViewport.ensureVisible(this.index, itemIds.length);

    if (Input.isActionTriggered("confirm")) {
      const selectedItemId = itemIds[this.index];

      if (selectedItemId !== undefined) {
        const used = $gameParty.useItem(selectedItemId, this.actor);

        if (used) {
          const updatedItemIds = this.itemIds();

          if (this.index >= updatedItemIds.length) {
            this.index = Math.max(0, updatedItemIds.length - 1);
          }

          this.listViewport.ensureVisible(this.index, updatedItemIds.length);
        }
      }
    }
  }

  itemIds() {
    return Object.keys($gameParty.items)
      .map(Number)
      .filter((itemId) => $gameParty.itemCount(itemId) > 0)
      .sort((a, b) => a - b);
  }

  show() {
    this.visible = true;

    this.index = 0;
    this.listViewport.reset(this.index, this.itemIds().length);
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
    context.font = "16px sans-serif";
    context.textAlign = "right";

    if (this.listViewport.hasPrevious()) {
      context.fillText("▲", this.x + this.width - 8, this.y + 105);
    }

    if (this.listViewport.hasNext(totalEntries)) {
      context.fillText("▼", this.x + this.width - 8, this.y + 285);
    }

    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.save();

    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    // -------------------------
    // Background
    // -------------------------

    context.fillStyle = "rgba(0, 0, 0, 0.88)";
    context.fillRect(this.x, this.y, this.width, this.height);

    // -------------------------
    // Border
    // -------------------------

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    // -------------------------
    // Title
    // -------------------------

    context.fillStyle = "#ffffff";
    context.font = "28px sans-serif";
    context.fillText("Items", this.x + this.padding, this.y + 42);

    // Divider line

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 60);
    context.lineTo(this.x + this.width - this.padding, this.y + 60);
    context.stroke();

    // -------------------------
    // Get inventory items
    // -------------------------

    const itemIds = this.itemIds();

    context.font = "22px sans-serif";

    // -------------------------
    // Empty inventory
    // -------------------------

    if (itemIds.length === 0) {
      context.fillText("(No items)", this.x + this.padding, this.y + 105);
      context.restore();

      return;
    }

    // -------------------------
    // Draw owned items
    // -------------------------

    const range = this.listViewport.visibleRange(this.index, itemIds.length);
    let drawY = this.y + 105;

    for (let i = range.start; i < range.end; i++) {
      const itemId = itemIds[i];
      const item = DatabaseManager.item(itemId);

      if (!item) {
        continue;
      }

      const amount = $gameParty.itemCount(itemId);
      const selected = i === this.index;
      const amountText = `x${amount}`;
      const amountWidth = context.measureText(amountText).width;

      const prefix = selected ? "▶ " : "  ";
      context.fillText(`${prefix}${item.name}`, this.x + this.padding, drawY);

      context.fillText(
        amountText,
        this.x + this.width - this.padding - amountWidth,
        drawY,
      );
      drawY += this.lineHeight;
    }

    this.drawScrollIndicators(context, itemIds.length);

    const selectedItemId = itemIds[this.index];
    const selectedItem = DatabaseManager.item(selectedItemId);

    if (selectedItem) {
      const dividerY = this.y + this.height - 125;

      context.beginPath();
      context.moveTo(this.x + this.padding, dividerY);
      context.lineTo(this.x + this.width - this.padding, dividerY);
      context.stroke();
      context.font = "18px sans-serif";

      context.fillText(
        selectedItem.description || "",
        this.x + this.padding,
        dividerY + 35,
      );
    }

    // =====================================
    // HP DISPLAY
    // =====================================

    const hp = this.actor?.hp ?? 0;
    const maxHp = this.actor?.maxHp ?? 0;

    // Keep the ratio between 0 and 1.

    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));

    // Position of the HP area.

    const hpY = this.y + this.height - 42;

    // -------------------------
    // HP label
    // -------------------------

    context.font = "18px sans-serif";
    context.fillStyle = "#ffffff";
    context.fillText("HP", this.x + this.padding, hpY);

    // -------------------------
    // HP bar background
    // -------------------------

    const barX = this.x + 65;
    const barY = hpY - 16;

    const barWidth = 230;
    const barHeight = 18;

    context.fillStyle = "#333333";
    context.fillRect(barX, barY, barWidth, barHeight);

    // -------------------------
    // Current HP
    // -------------------------

    context.fillStyle = "#ffffff";
    context.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    // -------------------------
    // HP numbers
    // -------------------------

    const hpText = `${hp}/${maxHp}`;

    context.font = "18px sans-serif";
    context.fillStyle = "#ffffff";
    context.fillText(hpText, barX + barWidth + 15, hpY);
    context.restore();
  }
}
