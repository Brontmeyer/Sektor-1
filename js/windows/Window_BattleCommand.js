"use strict";

class Window_BattleCommand {
  constructor() {
    this.commands = ["Attack", "Magic", "Item", "Defend"];
    
    this.index = 0;
    this.visible = true;

    this.width = 220;
    this.padding = 20;
    this.lineHeight = 40;

    this.height = this.padding * 2 + this.commands.length * this.lineHeight;

    this.x = 40;
    this.y = Graphics.height - this.height - 20;
  }

  currentCommand() {
    return this.commands[this.index];
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

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.save();

    context.fillStyle = "rgba(0, 0, 0, 0.85)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    context.font = "22px Arial";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";

    for (let i = 0; i < this.commands.length; i++) {
      const prefix = i === this.index ? "▶ " : "   ";

      const drawY =
        this.y + this.padding + this.lineHeight / 2 + i * this.lineHeight;

      context.fillText(
        `${prefix}${this.commands[i]}`,
        this.x + this.padding,
        drawY,
      );
    }
    context.restore();
  }
}
