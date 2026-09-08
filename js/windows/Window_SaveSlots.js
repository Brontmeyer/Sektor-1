"use strict";

class Window_SaveSlots {
  constructor() {
    this.visible = false;

    this.mode = "save";

    this.index = 0;

    this.result = null;

    this.slots = [1, 2, 3];

    this.width = 520;
    this.height = 300;

    this.padding = 30;
    this.lineHeight = 50;

    this.x = (Graphics.width - this.width) / 2;
    this.y = (Graphics.height - this.height) / 2;
  }

  show(mode = "save") {
    this.mode = mode;

    this.index = 0;

    this.result = null;

    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  currentSlotId() {
    return this.slots[this.index];
  }

  hasResult() {
    return this.result !== null;
  }

  takeResult() {
    const result = this.result;

    this.result = null;

    return result;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isTriggered("Escape")) {
      this.hide();

      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = this.slots.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= this.slots.length) {
        this.index = 0;
      }
    }

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      this.result = this.currentSlotId();

      this.visible = false;
    }
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.save();

    // Background
    context.fillStyle = "#000000";

    context.fillRect(this.x, this.y, this.width, this.height);

    // Border
    context.strokeStyle = "#ffffff";

    context.lineWidth = 2;

    context.strokeRect(this.x, this.y, this.width, this.height);

    // Title
    context.fillStyle = "#ffffff";

    context.font = "28px sans-serif";

    context.textAlign = "left";

    const title = this.mode === "load" ? "Load Game" : "Save Game";

    context.fillText(title, this.x + this.padding, this.y + 45);

    // Divider
    context.beginPath();

    context.moveTo(this.x + this.padding, this.y + 65);

    context.lineTo(this.x + this.width - this.padding, this.y + 65);

    context.stroke();

    // Slots
    context.font = "22px sans-serif";

    for (let i = 0; i < this.slots.length; i++) {
      const slotId = this.slots[i];

      const prefix = this.index === i ? "▶ " : "  ";

      const exists = SaveManager.exists(slotId);

      const status = exists ? "Save Data" : "Empty";

      const text = `${prefix}Slot ${slotId}    ${status}`;

      context.fillText(
        text,
        this.x + this.padding,
        this.y + 115 + i * this.lineHeight,
      );
    }

    context.restore();
  }
}
