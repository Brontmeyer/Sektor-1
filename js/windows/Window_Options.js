"use strict";

class Window_Options {
  constructor({ onControls = null, onWindowColor = null } = {}) {
    this.index = 0;
    this.onControls = onControls;
    this.onWindowColor = onWindowColor;
    this.options = [
      ...ConfigManager.optionDefinitions().map((option) => ({
        type: "option",
        ...option,
      })),
      {
        type: "windowColor",
        key: "windowColor",
        label: "Window Color",
        description: "Customize the four corner colors used by shared window panels.",
      },
      {
        type: "controls",
        key: "controls",
        label: "Controls",
        description: "Remap keyboard actions and restore default bindings.",
      },
    ];

    this.refreshLayout();
  }

  refreshLayout() {
    const layout = ConfigMenuLayout.calculate();

    this.x = layout.x;
    this.y = layout.y;
    this.width = layout.width;
    this.height = layout.height;
    this.gap = layout.gap;
    this.layout = layout;
    this.descriptionBounds = layout.descriptionBounds;
    this.titleBounds = layout.titleBounds;
    this.contentBounds = layout.contentBounds;
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
      } else if (option?.type === "windowColor") {
        this.onWindowColor?.();
      } else {
        this.cycleCurrent(1);
      }

      return true;
    }

    return false;
  }

  drawPanel(context, bounds, options = {}) {
    return ConfigMenuLayout.drawPanel(context, bounds, options);
  }

  drawSelection(context, x, y, width, height) {
    return ConfigMenuLayout.drawSelection(context, x, y, width, height);
  }

  drawHeader(context) {
    ConfigMenuLayout.drawHeader(context, this.layout, {
      title: "CONFIG",
      subtitle: "SYSTEM",
      description: this.currentOption()?.description || "Configure Sektor 1.",
    });
  }

  optionValue(option) {
    if (!option) {
      return "";
    }

    if (option.type === "controls" || option.type === "windowColor") {
      return "Open  ▶";
    }

    return `◀  ${ConfigManager.displayValue(option.key)}  ▶`;
  }

  drawContent(context) {
    const bounds = this.contentBounds;
    const bodyTop = bounds.y + 18;
    const bodyBottom = bounds.y + bounds.height - 18;
    const rowHeight = Math.max(
      52,
      Math.min(68, Math.floor((bodyBottom - bodyTop) / this.options.length)),
    );
    const labelX = bounds.x + 30;
    const valueX = bounds.x + bounds.width - 34;

    this.drawPanel(context, bounds);
    context.save();
    context.textBaseline = "middle";

    for (let i = 0; i < this.options.length; i++) {
      const option = this.options[i];
      const selected = i === this.index;
      const rowY = bodyTop + rowHeight / 2 + i * rowHeight;

      if (selected) {
        this.drawSelection(
          context,
          bounds.x + 16,
          rowY - rowHeight / 2 + 5,
          bounds.width - 32,
          rowHeight - 10,
        );
      }

      context.textAlign = "left";
      context.fillStyle = selected ? "#ffd75a" : "#7ff0d5";
      context.font = selected ? "600 18px sans-serif" : "18px sans-serif";
      context.fillText(`${selected ? "▶ " : "  "}${option.label}`, labelX, rowY);

      context.textAlign = "right";
      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
      context.fillText(this.optionValue(option), valueX, rowY);
    }

    context.restore();
  }

  draw() {
    this.refreshLayout();
    const context = Graphics.context;
    context.save();
    this.drawHeader(context);
    this.drawContent(context);
    context.restore();
  }
}
