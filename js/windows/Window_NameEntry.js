"use strict";

class Window_NameEntry {
  static KEYBOARD_ROWS = Object.freeze([
    Object.freeze(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]),
    Object.freeze(["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"]),
    Object.freeze(["U", "V", "W", "X", "Y", "Z"]),
    Object.freeze(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]),
    Object.freeze(["k", "l", "m", "n", "o", "p", "q", "r", "s", "t"]),
    Object.freeze(["u", "v", "w", "x", "y", "z"]),
  ]);

  static SIDE_COMMANDS = Object.freeze(["Space", "Delete", "Select", "Default"]);

  constructor(actor, options = {}) {
    this.actor = actor || null;
    this.title = String(options.title || "NAME").trim() || "NAME";
    this.prompt = String(options.prompt || "Please enter a name.");
    this.defaultValue = this.actor?.defaultName?.() || this.actor?.name || "Actor";
    this.value = options.startFromDefault === true
      ? this.defaultValue
      : this.actor?.name || this.defaultValue;
    this.maxLength = Math.max(
      1,
      Number(this.actor?.nameMaxLength?.()) || Game_Actor.NAME_MAX_LENGTH || 16,
    );
    this.replaceOnType = true;
    this.confirmed = false;

    this.focus = "grid";
    this.gridRow = 0;
    this.gridColumn = 0;
    this.commandIndex = 0;
    this.selectGridCharacter(String(this.value || this.defaultValue).charAt(0));

    this.portraitImage = this.createPortraitImage();
  }

  keyboardRows() {
    return Window_NameEntry.KEYBOARD_ROWS;
  }

  sideCommands() {
    return Window_NameEntry.SIDE_COMMANDS;
  }

  createPortraitImage() {
    if (typeof Image === "undefined" || !this.actor?.sideBattleSprite) {
      return null;
    }

    const image = new Image();
    image.loadFailed = false;
    image.onerror = () => {
      image.loadFailed = true;
    };
    image.src = `js/sprites/actors/${this.actor.sideBattleSprite}`;
    return image;
  }

  codePointLength(value = this.value) {
    return Array.from(String(value || "")).length;
  }

  appendCharacter(character) {
    const raw = Array.from(String(character ?? "").normalize("NFKC"))[0] || "";

    if (raw.length === 0 || /[\u0000-\u001f\u007f]/.test(raw)) {
      return false;
    }

    if (
      !Game_Actor.isAllowedNameCharacter(raw) &&
      !Game_Actor.isAllowedNameSeparator(raw)
    ) {
      return false;
    }

    const currentValue = this.replaceOnType ? "" : this.value;

    if (
      Game_Actor.isAllowedNameSeparator(raw) &&
      (!currentValue || /\s$/.test(currentValue))
    ) {
      return false;
    }

    if (this.replaceOnType) {
      this.value = "";
      this.replaceOnType = false;
    }

    if (Game_Actor.isAllowedNameSeparator(raw)) {
      if (!this.value || /\s$/.test(this.value)) {
        return false;
      }

      if (this.codePointLength() >= this.maxLength) {
        return false;
      }

      this.value += " ";
      return true;
    }

    if (this.codePointLength() >= this.maxLength) {
      return false;
    }

    this.value += raw;
    return true;
  }

  backspace() {
    this.replaceOnType = false;
    const characters = Array.from(this.value);

    if (characters.length === 0) {
      return false;
    }

    characters.pop();
    this.value = characters.join("");
    return true;
  }

  restoreDefault() {
    this.value = this.defaultValue;
    this.replaceOnType = true;
    return this.value;
  }

  confirm() {
    const requested = Game_Actor.normalizeName(this.value) || this.defaultValue;

    if (!this.actor?.rename?.(requested)) {
      return false;
    }

    this.value = this.actor.name;
    this.confirmed = true;
    return true;
  }

  isComplete() {
    return this.confirmed;
  }

  currentGridCharacter() {
    const row = this.keyboardRows()[this.gridRow] || [];
    return row[this.gridColumn] || row[0] || "";
  }

  currentSideCommand() {
    return this.sideCommands()[this.commandIndex] || this.sideCommands()[0];
  }

  selectGridCharacter(character) {
    if (!character) {
      return false;
    }

    for (let row = 0; row < this.keyboardRows().length; row++) {
      const column = this.keyboardRows()[row].indexOf(character);

      if (column >= 0) {
        this.gridRow = row;
        this.gridColumn = column;
        return true;
      }
    }

    return false;
  }

  moveGridVertical(direction) {
    const rows = this.keyboardRows();
    const nextRow = (this.gridRow + direction + rows.length) % rows.length;
    this.gridRow = nextRow;
    this.gridColumn = Math.min(this.gridColumn, rows[nextRow].length - 1);
  }

  moveGridHorizontal(direction) {
    const row = this.keyboardRows()[this.gridRow] || [];

    if (direction > 0 && this.gridColumn >= row.length - 1) {
      this.focus = "commands";
      this.commandIndex = Math.min(this.gridRow, this.sideCommands().length - 1);
      return;
    }

    if (direction < 0 && this.gridColumn <= 0) {
      this.gridColumn = row.length - 1;
      return;
    }

    this.gridColumn = Math.max(0, Math.min(row.length - 1, this.gridColumn + direction));
  }

  moveCommandVertical(direction) {
    const count = this.sideCommands().length;
    this.commandIndex = (this.commandIndex + direction + count) % count;
  }

  activateSelection() {
    if (this.focus === "grid") {
      return this.appendCharacter(this.currentGridCharacter());
    }

    switch (this.currentSideCommand()) {
      case "Space":
        return this.appendCharacter(" ");
      case "Delete":
        return this.backspace();
      case "Select":
        return this.confirm();
      case "Default":
        this.restoreDefault();
        return true;
      default:
        return false;
    }
  }

  updateNavigation() {
    if (Input.isActionTriggered?.("up")) {
      if (this.focus === "grid") {
        this.moveGridVertical(-1);
      } else {
        this.moveCommandVertical(-1);
      }
      return true;
    }

    if (Input.isActionTriggered?.("down")) {
      if (this.focus === "grid") {
        this.moveGridVertical(1);
      } else {
        this.moveCommandVertical(1);
      }
      return true;
    }

    if (Input.isActionTriggered?.("left")) {
      if (this.focus === "commands") {
        this.focus = "grid";
        const row = Math.min(this.commandIndex, this.keyboardRows().length - 1);
        this.gridRow = row;
        this.gridColumn = this.keyboardRows()[row].length - 1;
      } else {
        this.moveGridHorizontal(-1);
      }
      return true;
    }

    if (Input.isActionTriggered?.("right")) {
      if (this.focus === "grid") {
        this.moveGridHorizontal(1);
      }
      return true;
    }

    return false;
  }

  update() {
    if (this.confirmed) {
      return;
    }

    if (Input.isTextBackspaceTriggered?.()) {
      this.backspace();
      return;
    }

    if (Input.isTextResetTriggered?.()) {
      this.restoreDefault();
      return;
    }

    const characters = typeof Input.consumeTextCharacters === "function"
      ? Input.consumeTextCharacters()
      : [];

    if (this.focus === "grid" && characters.length > 0) {
      for (const character of characters) {
        this.appendCharacter(character);
      }

      // Printable keys take priority while the letter grid has focus so the
      // player's configured WASD / E bindings remain typeable name letters.
      // Arrow keys produce no printable text and continue to navigate the grid.
      return;
    }

    if (this.updateNavigation()) {
      return;
    }

    if (Input.isTextConfirmTriggered?.()) {
      this.activateSelection();
      return;
    }

    if (this.focus === "commands" && Input.isActionTriggered?.("confirm")) {
      this.activateSelection();
    }
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
          fallbackFill: "rgba(11, 16, 28, 0.97)",
          fallbackStroke: "rgba(150, 176, 220, 0.82)",
          lineWidth: 1.5,
          assetAlpha: 0.6,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
    }

    context.fillStyle = options.fallbackFill || "rgba(11, 16, 28, 0.97)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = options.fallbackStroke || "rgba(150, 176, 220, 0.82)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  drawSelection(context, bounds) {
    const drawn =
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawSelectionPanel === "function" &&
      UIAssetManager.drawSelectionPanel(
        context,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        { alpha: 0.2 },
      );

    if (!drawn) {
      context.fillStyle = "rgba(255, 215, 90, 0.12)";
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
  }

  drawPortrait(context, bounds) {
    const size = Math.min(bounds.width, bounds.height);
    const x = bounds.x + (bounds.width - size) / 2;
    const y = bounds.y + (bounds.height - size) / 2;

    if (
      typeof Window_ActorSummary !== "undefined" &&
      typeof Window_ActorSummary.drawPortraitPlaceholder === "function"
    ) {
      Window_ActorSummary.drawPortraitPlaceholder(
        context,
        this.actor,
        x,
        y,
        size,
      );
      return;
    }

    this.drawPanel(context, { x, y, width: size, height: size }, { assetAlpha: 0.34 });
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "600 44px sans-serif";
    context.fillText(
      String(this.value || this.defaultValue || "?").trim().charAt(0).toUpperCase() || "?",
      x + size / 2,
      y + size / 2,
    );
  }

  drawNameSlots(context, bounds) {
    this.drawPanel(context, bounds, { assetAlpha: 0.32 });

    const characters = Array.from(this.value || "").slice(0, this.maxLength);
    const padding = 18;
    const slotWidth = (bounds.width - padding * 2) / this.maxLength;
    const baselineY = bounds.y + bounds.height * 0.66;

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "600 21px sans-serif";

    for (let index = 0; index < this.maxLength; index++) {
      const x = bounds.x + padding + slotWidth * index;
      const character = characters[index] || "";

      context.strokeStyle = "rgba(174, 187, 208, 0.58)";
      context.lineWidth = 1;
      context.beginPath?.();
      context.moveTo?.(x + 3, baselineY + 18);
      context.lineTo?.(x + slotWidth - 3, baselineY + 18);
      context.stroke?.();

      if (character) {
        context.fillStyle = "#ffd75a";
        context.fillText(character, x + slotWidth / 2, baselineY);
      }
    }

    context.textAlign = "right";
    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(
      `${this.codePointLength()}/${this.maxLength}`,
      bounds.x + bounds.width - 14,
      bounds.y + 18,
    );
  }

  drawKeyboard(context, bounds) {
    this.drawPanel(context, bounds, { assetAlpha: 0.4 });
    const rows = this.keyboardRows();
    const columns = 10;
    const paddingX = 34;
    const paddingY = 22;
    const cellWidth = (bounds.width - paddingX * 2) / columns;
    const cellHeight = (bounds.height - paddingY * 2) / rows.length;

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "19px sans-serif";

    for (let row = 0; row < rows.length; row++) {
      for (let column = 0; column < rows[row].length; column++) {
        const x = bounds.x + paddingX + column * cellWidth;
        const y = bounds.y + paddingY + row * cellHeight;
        const selected =
          this.focus === "grid" && row === this.gridRow && column === this.gridColumn;

        if (selected) {
          this.drawSelection(context, {
            x: x + 2,
            y: y + 3,
            width: cellWidth - 4,
            height: cellHeight - 6,
          });
        }

        context.fillStyle = selected ? "#ffd75a" : "#ffffff";
        context.fillText(rows[row][column], x + cellWidth / 2, y + cellHeight / 2);
      }
    }
  }

  drawSideCommands(context, bounds) {
    this.drawPanel(context, bounds, { assetAlpha: 0.4 });
    const commands = this.sideCommands();
    const rowHeight = bounds.height / commands.length;

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = "17px sans-serif";

    for (let index = 0; index < commands.length; index++) {
      const selected = this.focus === "commands" && this.commandIndex === index;
      const rowBounds = {
        x: bounds.x + 12,
        y: bounds.y + index * rowHeight + 6,
        width: bounds.width - 24,
        height: rowHeight - 12,
      };

      if (selected) {
        this.drawSelection(context, rowBounds);
      }

      context.fillStyle = selected ? "#ffd75a" : "#ffffff";
      context.fillText(
        selected ? `▶ ${commands[index]}` : `   ${commands[index]}`,
        rowBounds.x + 10,
        rowBounds.y + rowBounds.height / 2,
      );
    }
  }

  draw() {
    const context = Graphics.context;
    const width = Math.min(930, Graphics.width - 48);
    const height = Math.min(610, Graphics.height - 48);
    const bounds = {
      x: Math.round((Graphics.width - width) / 2),
      y: Math.round((Graphics.height - height) / 2),
      width,
      height,
    };

    context.save();
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.backdrop()
      : "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    const promptBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: 74,
    };
    this.drawPanel(context, promptBounds);

    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.accent()
      : "#7ff0d5";
    context.font = "600 14px sans-serif";
    context.fillText(this.title, promptBounds.x + 26, promptBounds.y + 22);

    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.primary()
      : "#ffffff";
    context.font = "18px sans-serif";
    context.fillText(this.prompt, promptBounds.x + 26, promptBounds.y + 49);

    const identityBounds = {
      x: bounds.x,
      y: bounds.y + 82,
      width: bounds.width,
      height: 146,
    };
    this.drawPanel(context, identityBounds);

    const portraitBounds = {
      x: identityBounds.x + 20,
      y: identityBounds.y + 14,
      width: 118,
      height: 118,
    };
    this.drawPortrait(context, portraitBounds);

    const nameBounds = {
      x: portraitBounds.x + portraitBounds.width + 20,
      y: identityBounds.y + 28,
      width: identityBounds.width - portraitBounds.width - 78,
      height: 90,
    };
    this.drawNameSlots(context, nameBounds);

    const lowerY = bounds.y + 236;
    const lowerHeight = bounds.height - 278;
    const commandWidth = 190;
    const gap = 10;
    const keyboardBounds = {
      x: bounds.x,
      y: lowerY,
      width: bounds.width - commandWidth - gap,
      height: lowerHeight,
    };
    const commandBounds = {
      x: keyboardBounds.x + keyboardBounds.width + gap,
      y: lowerY,
      width: commandWidth,
      height: lowerHeight,
    };

    this.drawKeyboard(context, keyboardBounds);
    this.drawSideCommands(context, commandBounds);

    context.textAlign = "left";
    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(
      `Letters + spaces only  •  Type directly or use arrows  •  Enter: Select  •  Backspace: Delete  •  Default: ${this.defaultValue}`,
      bounds.x + 8,
      bounds.y + bounds.height - 18,
    );

    context.restore();
  }
}
