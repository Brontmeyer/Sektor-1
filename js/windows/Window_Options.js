"use strict";

class Window_Options {
  constructor({ onControls = null } = {}) {
    this.index = 0;
    this.onControls = onControls;
    this.options = [
      ...ConfigManager.optionDefinitions().map((option) => ({
        type: "option",
        ...option,
      })),
      {
        type: "controls",
        key: "controls",
        label: "Controls",
        description: "Remap keyboard actions and restore default bindings.",
      },
    ];

    this.x = 150;
    this.y = 130;
    this.width = Graphics.width - 300;
    this.height = Graphics.height - 220;
    this.padding = 28;
    this.lineHeight = 56;
  }

  update() {
    if (Input.isActionTriggered("up")) {
      this.index =
        (this.index - 1 + this.options.length) % this.options.length;
      return true;
    }

    if (Input.isActionTriggered("down")) {
      this.index = (this.index + 1) % this.options.length;
      return true;
    }

    if (Input.isActionTriggered("left")) {
      this.cycleCurrent(-1);
      return true;
    }

    if (Input.isActionTriggered("right")) {
      this.cycleCurrent(1);
      return true;
    }

    if (Input.isActionTriggered("confirm")) {
      const option = this.currentOption();

      if (option?.type === "controls") {
        this.onControls?.();
      } else {
        this.cycleCurrent(1);
      }

      return true;
    }

    return false;
  }

  currentOption() {
    return this.options[this.index] || null;
  }

  cycleCurrent(direction) {
    const option = this.currentOption();

    if (!option || option.type !== "option") {
      return null;
    }

    return ConfigManager.cycle(option.key, direction);
  }

  draw() {
    const context = Graphics.context;
    const contentX = this.x + this.padding;
    const valueX = this.x + this.width - this.padding;

    context.save();
    context.fillStyle = "rgba(8, 12, 18, 0.94)";
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeStyle = "rgba(135, 205, 255, 0.72)";
    context.lineWidth = 2;
    context.strokeRect(this.x, this.y, this.width, this.height);

    context.textBaseline = "middle";
    context.font = "22px Arial";

    for (let i = 0; i < this.options.length; i++) {
      const option = this.options[i];
      const selected = i === this.index;
      const rowY = this.y + 54 + i * this.lineHeight;

      if (selected) {
        context.fillStyle = "rgba(255, 215, 90, 0.09)";
        context.fillRect(
          this.x + 8,
          rowY - this.lineHeight / 2 + 4,
          this.width - 16,
          this.lineHeight - 8,
        );
        context.fillStyle = "#ffd75a";
        context.fillRect(
          this.x + 8,
          rowY - this.lineHeight / 2 + 8,
          4,
          this.lineHeight - 16,
        );
      }

      context.textAlign = "left";
      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.fillText(`${selected ? "▶ " : "  "}${option.label}`, contentX, rowY);

      context.textAlign = "right";
      context.fillStyle = selected ? "#ffd75a" : "#c8d3df";
      context.fillText(
        option.type === "controls"
          ? "Configure  ▶"
          : `◀  ${ConfigManager.displayValue(option.key)}  ▶`,
        valueX,
        rowY,
      );
    }

    const option = this.currentOption();
    const dividerY = this.y + this.height - 92;
    context.strokeStyle = "rgba(255, 255, 255, 0.18)";
    context.beginPath();
    context.moveTo(contentX, dividerY);
    context.lineTo(valueX, dividerY);
    context.stroke();

    context.textAlign = "left";
    context.fillStyle = "#aeb8c5";
    context.font = "16px Arial";
    context.fillText(option?.description || "", contentX, dividerY + 34);

    context.restore();
  }
}
