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

  update(deltaTime = 0) {
    if (!this.visible) {
      return;
    }

    this.updateTextReveal(deltaTime);

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
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

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;

    context.save();

    context.textAlign = "left";
    context.textBaseline = "top";

    // Window background.

    context.fillStyle = "rgba(0, 0, 0, 0.85)";
    context.fillRect(this.x, this.y, this.width, this.height);

    // Window border.

    context.strokeStyle = "white";
    context.lineWidth = 3;
    context.strokeRect(this.x, this.y, this.width, this.height);

    // Message text.

    context.fillStyle = "white";
    context.font = "24px Arial";
    context.textAlign = "left";
    context.textBaseline = "top";

    this.drawWrappedText(
      this.visibleText(),
      this.x + 25,
      this.y + 25,
      this.width - 50,
      32,
    );

    // Speaker name.

    if (this.speaker) {
      context.fillStyle = "rgba(0, 0, 0, 0.95)";
      context.fillRect(this.x + 20, this.y - 45, 220, 45);
      context.strokeStyle = "white";
      context.lineWidth = 2;
      context.strokeRect(this.x + 20, this.y - 45, 220, 45);

      context.fillStyle = "white";
      context.font = "22px Arial";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(this.speaker, this.x + 35, this.y - 22);
    }

    // Continue indicator.

    context.font = "18px Arial";
    context.textAlign = "right";

    context.fillText(
      this.isFullyRevealed() ? "E / Enter ▶" : "E / Enter: Reveal",
      this.x + this.width - 20,
      this.y + this.height - 35,
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
