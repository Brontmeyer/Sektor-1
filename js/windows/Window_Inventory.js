"use strict";

class Window_Inventory {
  constructor() {
    this.visible = false;

    this.index = 0;

    this.width = 500;
    this.height = 420;

    this.padding = 24;
    this.lineHeight = 40;

    this.x = (Graphics.width - this.width) / 2;

    this.y = (Graphics.height - this.height) / 2;
  }

  show() {
    this.visible = true;

    this.index = 0;

    console.log("Inventory opened.");
  }

  hide() {
    this.visible = false;

    console.log("Inventory closed.");
  }

  isOpen() {
    return this.visible;
  }

  update() {
    if (!this.visible) {
      return;
    }

    const itemIds = this.itemIds();

    if (Input.isTriggered("KeyI") || Input.isTriggered("Escape")) {
      this.hide();

      return;
    }

    if (itemIds.length === 0) {
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = itemIds.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= itemIds.length) {
        this.index = 0;
      }
    }

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      const selectedItemId = itemIds[this.index];

      if (selectedItemId !== undefined) {
        const used = $gameParty.useItem(selectedItemId);

        if (used) {
          const updatedItemIds = this.itemIds();

          if (this.index >= updatedItemIds.length) {
            this.index = Math.max(0, updatedItemIds.length - 1);
          }
        }
      }
    }
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

    let drawY = this.y + 105;

    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i];

      const item = DatabaseManager.item(itemId);

      if (!item) {
        continue;
      }

      const amount = $gameParty.itemCount(itemId);

      const selected = i === this.index;

      const prefix = selected ? "▶ " : "  ";

      context.fillText(`${prefix}${item.name}`, this.x + this.padding, drawY);

      const amountText = `x${amount}`;

      const amountWidth = context.measureText(amountText).width;

      context.fillText(
        amountText,
        this.x + this.width - this.padding - amountWidth,
        drawY,
      );

      drawY += this.lineHeight;
    }

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

    const hp = $gameActor.hp;

    const maxHp = $gameActor.maxHp;

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

  itemIds() {
    return Object.keys($gameParty.items)
      .map(Number)
      .filter((itemId) => $gameParty.itemCount(itemId) > 0)
      .sort((a, b) => a - b);
  }
}
