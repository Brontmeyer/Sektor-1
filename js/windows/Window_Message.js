"use strict";

class Window_Message {
  static INDICATOR_MODE = Object.freeze({
    CONTINUE: "continue",
    HIDDEN: "hidden",
  });

  static MAX_LINES = 4;
  static LINE_HEIGHT = 32;

  constructor() {
    this.visible = false;

    this.text = "";
    this.speaker = "";
    this.pages = [""];
    this.pageIndex = 0;
    this.revealedCharacters = 0;
    this.indicatorMode = Window_Message.INDICATOR_MODE.HIDDEN;
    this.indicatorElapsed = 0;
    this.holdOpenAtEnd = false;

    this.x = 40;
    this.width = Graphics.width - 80;
    this.height = 180;
    this.y = Graphics.height - this.height - 40;
  }

  themeColor(role, fallback) {
    return typeof UIThemePalette !== "undefined"
      ? UIThemePalette.color(role, fallback)
      : fallback;
  }

  update(deltaTime = 0, { allowInput = true } = {}) {
    if (!this.visible) {
      return;
    }

    const seconds = Math.max(0, Number(deltaTime) || 0);
    this.indicatorElapsed += seconds;
    this.updateTextReveal(seconds);

    if (!allowInput || !Input.isActionTriggered("confirm")) {
      return;
    }

    if (!this.isFullyRevealed()) {
      this.revealAll();
      return;
    }

    if (this.hasNextPage()) {
      this.advancePage();
      return;
    }

    if (!this.holdOpenAtEnd) {
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

  currentPageText() {
    return this.pages[this.pageIndex] || "";
  }

  textCharacters() {
    return Array.from(this.currentPageText());
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

  isMessageFullyRevealed() {
    return !this.hasNextPage() && this.isFullyRevealed();
  }

  revealAll() {
    this.revealedCharacters = this.characterCount();
  }

  hasNextPage() {
    return this.pageIndex < this.pages.length - 1;
  }

  advancePage() {
    if (!this.hasNextPage()) {
      return false;
    }

    this.pageIndex += 1;
    this.revealedCharacters = 0;
    this.indicatorElapsed = 0;
    return true;
  }

  show(text, speaker = "", options = {}) {
    this.visible = true;

    this.text = text || "";
    this.speaker = speaker || "";
    this.pages = this.preparePages(this.text);
    this.pageIndex = 0;
    this.revealedCharacters = 0;
    this.indicatorMode = this.normalizeIndicatorMode(options.indicatorMode);
    this.indicatorElapsed = 0;
    this.holdOpenAtEnd = options.holdOpenAtEnd === true;
  }

  normalizeIndicatorMode(mode) {
    if (mode === "continue") {
      return Window_Message.INDICATOR_MODE.CONTINUE;
    }

    // Legacy callers may still pass "end". Final dialogue no longer displays
    // a continuation marker, so treat every non-continuation mode as hidden.
    return Window_Message.INDICATOR_MODE.HIDDEN;
  }

  messageTextWidth() {
    return Math.max(1, this.width - 50);
  }

  wrapLines(text) {
    const context = Graphics.context;

    if (
      context &&
      typeof context.measureText === "function" &&
      typeof Window_TextLayout !== "undefined" &&
      typeof Window_TextLayout.wrapLines === "function"
    ) {
      context.save?.();
      const previousFont = context.font;
      context.font = "24px sans-serif";
      const lines = Window_TextLayout.wrapLines(
        context,
        text,
        this.messageTextWidth(),
      );
      context.font = previousFont;
      context.restore?.();
      return lines;
    }

    return String(text || "").split("\n");
  }

  preparePages(text) {
    const lines = this.wrapLines(text);
    const pages = [];

    for (let index = 0; index < lines.length; index += Window_Message.MAX_LINES) {
      pages.push(lines.slice(index, index + Window_Message.MAX_LINES).join("\n"));
    }

    return pages.length > 0 ? pages : [""];
  }

  indicatorShouldDraw() {
    if (!this.isFullyRevealed()) {
      return false;
    }

    if (this.hasNextPage()) {
      return Math.floor(this.indicatorElapsed / 0.36) % 2 === 0;
    }

    if (this.indicatorMode !== Window_Message.INDICATOR_MODE.CONTINUE) {
      return false;
    }

    return Math.floor(this.indicatorElapsed / 0.36) % 2 === 0;
  }

  drawAdvanceIndicator(context) {
    if (!this.indicatorShouldDraw()) {
      return;
    }

    context.save();
    context.fillStyle = this.themeColor("accent", "#7ff0d5");
    context.font = "600 22px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      "▼",
      this.x + this.width - 28,
      this.y + this.height - 24,
    );
    context.restore();
  }

  hide() {
    this.visible = false;

    this.text = "";
    this.speaker = "";
    this.pages = [""];
    this.pageIndex = 0;
    this.revealedCharacters = 0;
    this.indicatorMode = Window_Message.INDICATOR_MODE.HIDDEN;
    this.indicatorElapsed = 0;
    this.holdOpenAtEnd = false;
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

    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "24px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "top";

    this.drawWrappedText(
      this.visibleText(),
      this.x + 25,
      this.y + 25,
      this.width - 50,
      Window_Message.LINE_HEIGHT,
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

      context.fillStyle = this.themeColor("primary", "#ffffff");
      context.font = "600 20px sans-serif";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(
        this.speaker,
        speakerBounds.x + 16,
        speakerBounds.y + speakerBounds.height / 2,
      );
    }

    this.drawAdvanceIndicator(context);
    context.restore();
  }

  drawWrappedText(text, x, y, maxWidth, lineHeight) {
    const context = Graphics.context;

    if (
      typeof Window_TextLayout !== "undefined" &&
      typeof Window_TextLayout.drawWrappedText === "function"
    ) {
      return Window_TextLayout.drawWrappedText(
        context,
        text,
        x,
        y,
        maxWidth,
        lineHeight,
        Window_Message.MAX_LINES,
      );
    }

    let currentY = y;
    for (const line of String(text || "").split("\n").slice(0, Window_Message.MAX_LINES)) {
      context.fillText(line, x, currentY);
      currentY += lineHeight;
    }

    return { nextY: currentY };
  }
}
