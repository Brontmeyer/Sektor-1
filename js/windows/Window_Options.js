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
    const margin = Math.max(12, Math.min(22, Math.floor(Graphics.width * 0.014)));
    const gap = 8;
    const width = Graphics.width - margin * 2;
    const height = Graphics.height - margin * 2;
    const headerHeight = 70;
    const titleWidth = Math.max(250, Math.min(320, Math.floor(width * 0.255)));

    this.x = margin;
    this.y = margin;
    this.width = width;
    this.height = height;
    this.gap = gap;
    this.descriptionBounds = {
      x: margin,
      y: margin,
      width: width - titleWidth - gap,
      height: headerHeight,
    };
    this.titleBounds = {
      x: margin + width - titleWidth,
      y: margin,
      width: titleWidth,
      height: headerHeight,
    };
    this.contentBounds = {
      x: margin,
      y: margin + headerHeight + gap,
      width,
      height: height - headerHeight - gap,
    };
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
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      return UIAssetManager.drawPanel(
        context,
        "menuPanel",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(11, 16, 28, 0.96)",
          fallbackStroke: "rgba(150, 176, 220, 0.78)",
          innerStroke: "rgba(232, 234, 255, 0.14)",
          lineWidth: 1.5,
          assetAlpha: 0.54,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
    }

    context.fillStyle = options.fallbackFill || "rgba(11, 16, 28, 0.96)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle =
      options.fallbackStroke || "rgba(150, 176, 220, 0.78)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  drawSelection(context, x, y, width, height) {
    const drawn =
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawSelectionPanel === "function" &&
      UIAssetManager.drawSelectionPanel(context, x, y, width, height, {
        alpha: 0.2,
      });

    if (!drawn) {
      context.fillStyle = "rgba(255, 215, 90, 0.1)";
      context.fillRect(x, y, width, height);
    }
  }

  drawHeader(context) {
    const option = this.currentOption();
    const description = this.descriptionBounds;
    const title = this.titleBounds;

    this.drawPanel(context, description, { assetAlpha: 0.46 });
    this.drawPanel(context, title, { assetAlpha: 0.54 });

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.font = "17px sans-serif";
    context.fillText(
      option?.description || "Configure Sektor 1.",
      description.x + 20,
      description.y + description.height / 2,
      description.width - 40,
    );

    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText("CONFIG", title.x + title.width / 2, title.y + 27);
    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText("SYSTEM", title.x + title.width / 2, title.y + 50);
    context.restore();
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
