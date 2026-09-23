"use strict";

class Window_Message {
  constructor() {
    this.visible = false;

    this.text = "";
    this.speaker = "";
    this.revealedCharacters = 0;

    this.x = 40;
    this.width = Graphics.width - 80;
    this.height = 180;
    this.y = Graphics.height - this.height - 40;
  }

  update(deltaTime = 0, { allowInput = true } = {}) {
    if (!this.visible) {
      return;
    }

    this.updateTextReveal(deltaTime);

    if (allowInput && Input.isActionTriggered("confirm")) {
      if (!this.isFullyRevealed()) {
        this.revealAll();
        return;
      }

      this.hide();
    }
  }

  charactersPerSecond() {
    if (typeof ConfigManager === "undefined") {
      return 42;
    }

    return ConfigManager.fieldMessageCharactersPerSecond();
  }

  updateTextReveal(deltaTime) {
    const seconds = Math.max(0, Number(deltaTime) || 0);
    const speed = Math.max(1, Number(this.charactersPerSecond()) || 42);

    this.revealedCharacters = Math.min(
      this.characterCount(),
      this.revealedCharacters + speed * seconds,
    );
  }

  textCharacters() {
    return Array.from(this.text);
  }

  characterCount() {
    return this.textCharacters().length;
  }

  visibleText() {
    return this.textCharacters()
      .slice(0, Math.floor(this.revealedCharacters))
      .join("");
  }

  isFullyRevealed() {
    return this.revealedCharacters >= this.characterCount();
  }

  revealAll() {
    this.revealedCharacters = this.characterCount();
  }

  show(text, speaker = "") {
    this.visible = true;

    this.text = text || "";
    this.speaker = speaker || "";
    this.revealedCharacters = 0;
  }

  hide() {
    this.visible = false;

    this.text = "";
    this.speaker = "";
    this.revealedCharacters = 0;
  }

  isOpen() {
    return this.visible;
  }

  drawPanel(context, bounds, role = "menuPanel", options = {}) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      return UIAssetManager.drawPanel(
        context,
        role,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(11, 16, 28, 0.96)",
          fallbackStroke: "rgba(150, 176, 220, 0.78)",
          innerStroke: "rgba(232, 234, 255, 0.14)",
          lineWidth: 1.5,
          assetAlpha: role === "accentPanel" ? 0.5 : 0.54,
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

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    const messageBounds = {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };

    context.save();
    this.drawPanel(context, messageBounds, "menuPanel", { assetAlpha: 0.5 });

    context.fillStyle = "#ffffff";
    context.font = "24px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "top";

    this.drawWrappedText(
      this.visibleText(),
      this.x + 25,
      this.y + 25,
      this.width - 50,
      32,
    );

    if (this.speaker) {
      const speakerBounds = {
        x: this.x + 18,
        y: this.y - 46,
        width: 220,
        height: 48,
      };
      this.drawPanel(context, speakerBounds, "accentPanel", {
        assetAlpha: 0.5,
        shadow: false,
      });

      context.fillStyle = "#ffffff";
      context.font = "600 20px sans-serif";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(
        this.speaker,
        speakerBounds.x + 16,
        speakerBounds.y + speakerBounds.height / 2,
      );
    }

    context.font = "17px sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = this.isFullyRevealed() ? "#ffd75a" : "#aebbd0";
    context.fillText(
      this.isFullyRevealed()
        ? `${Input.actionLabel("confirm")}  ▶`
        : `${Input.actionLabel("confirm")}: Reveal`,
      this.x + this.width - 20,
      this.y + this.height - 27,
    );
    context.restore();
  }

  drawWrappedText(text, x, y, maxWidth, lineHeight) {
    const context = Graphics.context;
    let currentY = y;

    for (const paragraph of String(text).split("\n")) {
      const words = paragraph.split(" ");
      let line = "";

      for (const word of words) {
        const testLine = line.length > 0 ? line + " " + word : word;
        const testWidth = context.measureText(testLine).width;

        if (testWidth > maxWidth && line.length > 0) {
          context.fillText(line, x, currentY);
          line = word;
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }

      if (line.length > 0) {
        context.fillText(line, x, currentY);
      }

      currentY += lineHeight;
    }
  }
}
