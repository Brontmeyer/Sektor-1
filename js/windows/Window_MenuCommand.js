"use strict";

class Window_MenuCommand {
  constructor() {
    this.visible = true;

    this.commands = ["Items", "Status", "Equipment", "Save", "Load","Options", "Exit"];

    this.index = 0;

    this.width = 300;
    this.height = 410;

    this.padding = 24;
    this.lineHeight = 45;

    this.x = 60;
    this.y = 100;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = this.commands.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= this.commands.length) {
        this.index = 0;
      }
    }
  }

  currentCommand() {
    return this.commands[this.index];
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.save();

    context.textAlign = "left";
    context.textBaseline = "alphabetic";

    // Background

    context.fillStyle = "rgba(0, 0, 0, 0.95)";

    context.fillRect(this.x, this.y, this.width, this.height);

    // Border

    context.strokeStyle = "#ffffff";

    context.lineWidth = 2;

    context.strokeRect(this.x, this.y, this.width, this.height);

    // Title

    context.fillStyle = "#ffffff";

    context.font = "26px sans-serif";

    context.fillText("Menu", this.x + this.padding, this.y + 42);

    // Divider

    context.beginPath();

    context.moveTo(this.x + this.padding, this.y + 60);

    context.lineTo(this.x + this.width - this.padding, this.y + 60);

    context.stroke();

    // Commands

    context.font = "22px sans-serif";

    let drawY = this.y + 105;

    for (let i = 0; i < this.commands.length; i++) {
      const selected = i === this.index;

      const prefix = selected ? "▶ " : "  ";

      context.fillText(
        `${prefix}${this.commands[i]}`,
        this.x + this.padding,
        drawY,
      );

      drawY += this.lineHeight;
    }

    context.restore();
  }
}
