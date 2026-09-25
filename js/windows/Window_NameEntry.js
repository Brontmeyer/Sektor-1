"use strict";

class Window_NameEntry {
  constructor(actor, options = {}) {
    this.actor = actor || null;
    this.title = String(options.title || "NAME").trim() || "NAME";
    this.prompt = String(
      options.prompt || "Choose the name this character will use throughout the story.",
    );
    this.value = this.actor?.name || this.actor?.defaultName?.() || "";
    this.defaultValue = this.actor?.defaultName?.() || this.value || "Actor";
    this.maxLength = Math.max(
      1,
      Number(this.actor?.nameMaxLength?.()) || Game_Actor.NAME_MAX_LENGTH || 16,
    );
    this.replaceOnType = true;
    this.confirmed = false;
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

  update() {
    if (this.confirmed) {
      return;
    }

    if (Input.isTextBackspaceTriggered?.()) {
      this.backspace();
    }

    if (Input.isTextResetTriggered?.()) {
      this.restoreDefault();
    }

    const characters = typeof Input.consumeTextCharacters === "function"
      ? Input.consumeTextCharacters()
      : [];

    for (const character of characters) {
      this.appendCharacter(character);
    }

    // Name entry deliberately confirms on the physical Enter key rather than
    // the configurable Confirm action. This lets E remain a normal printable
    // character while the player is typing a name.
    if (Input.isTextConfirmTriggered?.()) {
      this.confirm();
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

  draw() {
    const context = Graphics.context;
    const width = Math.min(760, Graphics.width - 48);
    const height = Math.min(390, Graphics.height - 48);
    const bounds = {
      x: Math.round((Graphics.width - width) / 2),
      y: Math.round((Graphics.height - height) / 2),
      width,
      height,
    };

    context.save();
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    this.drawPanel(context, bounds);

    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.primary()
      : "#ffffff";
    context.font = "600 24px sans-serif";
    context.fillText(this.title, bounds.x + 28, bounds.y + 38);

    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.secondary()
      : "#aebbd0";
    context.font = "15px sans-serif";

    if (
      typeof Window_TextLayout !== "undefined" &&
      typeof Window_TextLayout.drawWrappedText === "function"
    ) {
      Window_TextLayout.drawWrappedText(
        context,
        this.prompt,
        bounds.x + 28,
        bounds.y + 76,
        bounds.width - 56,
        20,
        2,
      );
    } else {
      context.fillText(this.prompt, bounds.x + 28, bounds.y + 76);
    }

    const portraitBounds = {
      x: bounds.x + 34,
      y: bounds.y + 126,
      width: 118,
      height: 118,
    };
    this.drawPanel(context, portraitBounds, { assetAlpha: 0.34 });
    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.font = "600 44px sans-serif";
    context.fillText(
      String(this.value || this.defaultValue || "?").trim().charAt(0).toUpperCase() || "?",
      portraitBounds.x + portraitBounds.width / 2,
      portraitBounds.y + portraitBounds.height / 2,
    );

    const fieldBounds = {
      x: bounds.x + 186,
      y: bounds.y + 138,
      width: bounds.width - 220,
      height: 58,
    };
    this.drawSelection(context, fieldBounds);
    context.strokeStyle = "rgba(127, 240, 213, 0.55)";
    context.lineWidth = 1;
    context.strokeRect(
      fieldBounds.x,
      fieldBounds.y,
      fieldBounds.width,
      fieldBounds.height,
    );

    context.textAlign = "left";
    context.fillStyle = "#ffd75a";
    context.font = "600 25px sans-serif";
    context.fillText(
      this.value || " ",
      fieldBounds.x + 18,
      fieldBounds.y + fieldBounds.height / 2,
    );

    context.textAlign = "right";
    context.fillStyle = "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(
      `${this.codePointLength()}/${this.maxLength}`,
      fieldBounds.x + fieldBounds.width - 14,
      fieldBounds.y + fieldBounds.height + 24,
    );

    context.textAlign = "left";
    context.fillStyle = "#7ff0d5";
    context.font = "600 14px sans-serif";
    context.fillText("DEFAULT", bounds.x + 186, bounds.y + 250);
    context.fillStyle = "#ffffff";
    context.font = "17px sans-serif";
    context.fillText(this.defaultValue, bounds.x + 276, bounds.y + 250);

    context.fillStyle = "#aebbd0";
    context.font = "14px sans-serif";
    context.fillText(
      "Letters + spaces only  •  Backspace: Delete  •  Esc: Default  •  Enter: Confirm",
      bounds.x + 28,
      bounds.y + bounds.height - 34,
    );

    context.restore();
  }
}
