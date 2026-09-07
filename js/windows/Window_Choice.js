"use strict";

class Window_Choice {
  constructor() {
    this.visible = false;

    this.choices = [];

    this.index = 0;

    this.result = null;

    this.width = 360;

    this.lineHeight = 42;

    this.padding = 20;

    this.x = Graphics.width - this.width - 60;

    this.y = 0;
  }

  show(choices) {
    this.choices = choices || [];

    this.index = 0;

    this.result = null;

    this.visible = true;

    this.updatePosition();
  }

  hide() {
    this.visible = false;

    this.choices = [];

    this.index = 0;
  }

  isOpen() {
    return this.visible;
  }

  updatePosition() {
    const height = this.padding * 2 + this.choices.length * this.lineHeight;

    this.height = height;

    this.y = Graphics.height - 40 - 180 - this.height - 10;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isTriggered("ArrowUp") || Input.isTriggered("KeyW")) {
      this.index--;

      if (this.index < 0) {
        this.index = this.choices.length - 1;
      }
    }

    if (Input.isTriggered("ArrowDown") || Input.isTriggered("KeyS")) {
      this.index++;

      if (this.index >= this.choices.length) {
        this.index = 0;
      }
    }

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      this.result = this.index;

      this.visible = false;
    }
  }

  hasResult() {
    return this.result !== null;
  }

  getResult() {
    return this.result;
  }

  clearResult() {
    this.result = null;
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.fillStyle = "rgba(0, 0, 0, 0.9)";

    context.fillRect(this.x, this.y, this.width, this.height);

    context.strokeStyle = "white";

    context.lineWidth = 2;

    context.strokeRect(this.x, this.y, this.width, this.height);

    context.font = "22px Arial";

    context.textAlign = "left";

    context.textBaseline = "middle";

    for (let i = 0; i < this.choices.length; i++) {
      const choiceY =
        this.y + this.padding + this.lineHeight * i + this.lineHeight / 2;

      if (i === this.index) {
        context.fillStyle = "rgba(255, 255, 255, 0.15)";

        context.fillRect(
          this.x + 8,
          choiceY - this.lineHeight / 2,
          this.width - 16,
          this.lineHeight,
        );
      }

      context.fillStyle = "white";

      const prefix = i === this.index ? "▶ " : "  ";

      context.fillText(prefix + this.choices[i], this.x + 20, choiceY);
    }
  }
}
