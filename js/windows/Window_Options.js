"use strict";

class Window_Options {
  constructor({ onControls = null, onWindowColor = null } = {}) {
    this.index = 0;
    this.onControls = onControls;
    this.onWindowColor = onWindowColor;
    this.magickOrderEditing = false;
    this.magickOrderIndex = 0;
    this.options = [
      ...ConfigManager.optionDefinitions().map((option) => ({
        type: "option",
        ...option,
      })),
      {
        type: "magickOrder",
        key: "magickCategoryOrder",
        label: "Magick Order",
        description:
          "Customize category priority for field and battle Magick. Magick inside each category stays in stable ID order.",
      },
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

  playSe(key) {
    if (typeof AudioManager !== "undefined") {
      AudioManager.playSe?.(key);
    }
  }

  isEditingMagickOrder() {
    return this.magickOrderEditing;
  }

  currentDescription() {
    if (this.magickOrderEditing) {
      return "Magick Order: Up/Down selects a category; Left/Right moves its priority; Confirm or Back finishes.";
    }

    return this.currentOption()?.description || "Configure Sektor 1.";
  }

  cycleCurrent(direction) {
    const option = this.currentOption();

    if (!option || option.type !== "option") {
      return null;
    }

    return ConfigManager.cycle(option.key, direction);
  }

  beginMagickOrderEditing() {
    this.magickOrderEditing = true;
    this.magickOrderIndex = 0;
    return true;
  }

  updateMagickOrderEditing() {
    const order = ConfigManager.magickCategoryOrder();

    if (Input.isActionTriggered("cancel") || Input.isActionTriggered("confirm")) {
      this.magickOrderEditing = false;
      this.playSe(Input.isActionTriggered("cancel") ? "ui.cancel" : "ui.confirm");
      return true;
    }

    if (Input.isActionTriggered("up")) {
      this.magickOrderIndex =
        (this.magickOrderIndex - 1 + order.length) % order.length;
      this.playSe("ui.cursor");
      return true;
    }

    if (Input.isActionTriggered("down")) {
      this.magickOrderIndex = (this.magickOrderIndex + 1) % order.length;
      this.playSe("ui.cursor");
      return true;
    }

    if (Input.isActionTriggered("left") || Input.isActionTriggered("right")) {
      const category = order[this.magickOrderIndex];
      const direction = Input.isActionTriggered("left") ? -1 : 1;
      this.magickOrderIndex = ConfigManager.moveMagickCategory(
        category,
        direction,
      );
      this.playSe("ui.cursor");
      return true;
    }

    return false;
  }

  update() {
    if (this.magickOrderEditing) {
      return this.updateMagickOrderEditing();
    }

    if (Input.isActionTriggered("up")) {
      this.index =
        (this.index - 1 + this.options.length) % this.options.length;
      this.playSe("ui.cursor");
      return true;
    }

    if (Input.isActionTriggered("down")) {
      this.index = (this.index + 1) % this.options.length;
      this.playSe("ui.cursor");
      return true;
    }

    if (Input.isActionTriggered("left")) {
      if (this.cycleCurrent(-1) !== null) {
        this.playSe("ui.cursor");
      }
      return true;
    }

    if (Input.isActionTriggered("right")) {
      if (this.cycleCurrent(1) !== null) {
        this.playSe("ui.cursor");
      }
      return true;
    }

    if (Input.isActionTriggered("confirm")) {
      const option = this.currentOption();
      this.playSe("ui.confirm");

      if (option?.type === "controls") {
        this.onControls?.();
      } else if (option?.type === "windowColor") {
        this.onWindowColor?.();
      } else if (option?.type === "magickOrder") {
        this.beginMagickOrderEditing();
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
      subtitle: this.magickOrderEditing ? "MAGICK ORDER" : "SYSTEM",
      description: this.currentDescription(),
    });
  }

  optionValue(option) {
    if (!option) {
      return "";
    }

    if (option.type === "controls" || option.type === "windowColor") {
      return "Open  ▶";
    }

    if (option.type === "magickOrder") {
      return `${ConfigManager.magickCategoryOrderLabel(" > ")}  ▶`;
    }

    return `◀  ${ConfigManager.displayValue(option.key)}  ▶`;
  }

  drawContent(context) {
    if (this.magickOrderEditing) {
      this.drawMagickOrderEditor(context);
      return;
    }

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

  drawMagickOrderEditor(context) {
    const bounds = this.contentBounds;
    const order = ConfigManager.magickCategoryOrder();
    const labels = ConfigManager.magickCategoryLabels();
    const editorWidth = Math.min(620, bounds.width - 80);
    const editorX = bounds.x + Math.floor((bounds.width - editorWidth) / 2);
    const headingY = bounds.y + 64;
    const rowHeight = 72;
    const rowStartY = bounds.y + 142;

    this.drawPanel(context, bounds);
    context.save();
    context.textBaseline = "middle";
    context.textAlign = "center";
    context.fillStyle = "#7ff0d5";
    context.font = "600 18px sans-serif";
    context.fillText("MAGICK CATEGORY PRIORITY", bounds.x + bounds.width / 2, headingY);

    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    context.fillText(
      "Top categories appear first. Magick within each category is always ordered by ID.",
      bounds.x + bounds.width / 2,
      headingY + 30,
    );

    for (let i = 0; i < order.length; i++) {
      const category = order[i];
      const selected = i === this.magickOrderIndex;
      const rowY = rowStartY + i * rowHeight;

      if (selected) {
        this.drawSelection(
          context,
          editorX,
          rowY - rowHeight / 2 + 6,
          editorWidth,
          rowHeight - 12,
        );
      }

      context.textAlign = "left";
      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.font = selected ? "600 20px sans-serif" : "20px sans-serif";
      context.fillText(
        `${selected ? "▶ " : "  "}${i + 1}. ${labels[category] || category}`,
        editorX + 24,
        rowY,
      );

      context.textAlign = "right";
      context.fillStyle = selected ? "#ffd75a" : "#7ff0d5";
      context.font = "15px sans-serif";
      context.fillText(
        selected ? "◀  MOVE  ▶" : "",
        editorX + editorWidth - 24,
        rowY,
      );
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
