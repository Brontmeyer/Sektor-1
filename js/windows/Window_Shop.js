"use strict";

class Window_Shop {
  constructor(shopData = {}) {
    this.title = shopData.name || "Shop";
    this.goods = Array.isArray(shopData.goods) ? shopData.goods : [];
    this.index = 0;
    this.result = null;
    this.message = "";

    this.width = 900;
    this.height = 600;
    this.padding = 28;
    this.lineHeight = 42;
    this.listViewport = new Window_ListViewport(7);

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
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
          id: good.id,
          data,
          name: data.name,
          price: Number(data.price) || 0,
          owned: $gameParty?.merchandiseCount?.(good.type, good.id) || 0,
        };
      })
      .filter((entry) => entry !== null);
  }

  currentEntry() {
    return this.entries()[this.index] || null;
  }

  typeLabel(type) {
    return {
      item: "Item",
      weapon: "Weapon",
      armor: "Armor",
      accessory: "Accessory",
    }[type] || "Goods";
  }

  update() {
    if (this.result !== null) {
      return;
    }

    const entries = this.entries();

    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      this.result = { action: "cancel" };
      return;
    }

    if (entries.length === 0) {
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index = (this.index - 1 + entries.length) % entries.length;
      this.message = "";
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index = (this.index + 1) % entries.length;
      this.message = "";
    }

    this.listViewport.ensureVisible(this.index, entries.length);

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      const entry = this.currentEntry();

      if (entry) {
        this.result = {
          action: "purchase",
          type: entry.type,
          id: entry.id,
        };
      }
    }
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

  drawScrollIndicators(context, totalEntries) {
    context.save();
    context.fillStyle = "#ffffff";
    context.font = "16px sans-serif";
    context.textAlign = "right";

    if (this.listViewport.hasPrevious()) {
      context.fillText("▲", this.x + this.width - 8, this.y + 125);
    }

    if (this.listViewport.hasNext(totalEntries)) {
      context.fillText("▼", this.x + this.width - 8, this.y + 380);
    }

    context.restore();
  }

  draw() {
    const context = Graphics.context;
    const entries = this.entries();
    const current = entries[this.index] || null;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    context.fillStyle = "rgba(0, 0, 0, 0.95)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    context.fillStyle = "#ffffff";
    context.font = "28px sans-serif";
    context.fillText(this.title, this.x + this.padding, this.y + 44);

    context.font = "20px sans-serif";
    context.textAlign = "right";
    context.fillText(
      `Gil: ${$gameParty?.gil?.() ?? 0}`,
      this.x + this.width - this.padding,
      this.y + 44,
    );
    context.textAlign = "left";

    context.beginPath();
    context.moveTo(this.x + this.padding, this.y + 66);
    context.lineTo(this.x + this.width - this.padding, this.y + 66);
    context.stroke();

    if (entries.length === 0) {
      context.font = "21px sans-serif";
      context.fillText("(No merchandise)", this.x + this.padding, this.y + 120);
      context.restore();
      return;
    }

    const range = this.listViewport.visibleRange(this.index, entries.length);
    let drawY = this.y + 118;

    context.font = "20px sans-serif";

    for (let i = range.start; i < range.end; i++) {
      const entry = entries[i];
      const prefix = i === this.index ? "▶ " : "  ";
      const category = this.typeLabel(entry.type);
      const leftText = `${prefix}[${category}] ${entry.name}`;
      const rightText = `${entry.price} Gil   Owned ${entry.owned}`;

      context.fillText(leftText, this.x + this.padding, drawY);
      context.textAlign = "right";
      context.fillText(rightText, this.x + this.width - this.padding, drawY);
      context.textAlign = "left";
      drawY += this.lineHeight;
    }

    this.drawScrollIndicators(context, entries.length);

    const dividerY = this.y + 430;
    context.beginPath();
    context.moveTo(this.x + this.padding, dividerY);
    context.lineTo(this.x + this.width - this.padding, dividerY);
    context.stroke();

    context.font = "18px sans-serif";
    if (current) {
      context.fillText(
        current.data.description || "",
        this.x + this.padding,
        dividerY + 36,
      );
    }

    if (this.message) {
      context.font = "19px sans-serif";
      context.fillText(this.message, this.x + this.padding, dividerY + 78);
    }

    context.font = "16px sans-serif";
    context.fillText(
      "Enter: Buy 1    Q/Esc: Leave",
      this.x + this.padding,
      this.y + this.height - 28,
    );

    context.restore();
  }
}
