"use strict";

class UIAssetManager {
  static WINDOW_SKIN_FRAME_SIZE = 96;
  static WINDOW_SKIN_FRAME_MARGIN = 24;
  static ICON_SIZE = 32;
  static ICON_COLUMNS = 16;

  static _manifest = Object.freeze({
    windowSkin: "js/sprites/ui/rmmz/Window.png",
    iconSet: "js/sprites/ui/rmmz/IconSet.png",
    buttonSet: "js/sprites/ui/rmmz/ButtonSet.png",
    battleShadow: "js/sprites/ui/rmmz/Shadow2.png",
  });

  static _images = new Map();
  static _failed = new Set();
  static _initialized = false;

  static manifest() {
    return { ...this._manifest };
  }

  static async initialize() {
    if (this._initialized) {
      return this.summary();
    }

    this._initialized = true;
    this._images.clear();
    this._failed.clear();

    if (typeof Image !== "function") {
      return this.summary();
    }

    await Promise.all(
      Object.entries(this._manifest).map(([key, path]) =>
        this.loadImage(key, path),
      ),
    );

    return this.summary();
  }

  static loadImage(key, path) {
    return new Promise((resolve) => {
      const image = new Image();

      image.addEventListener("load", () => {
        this._images.set(key, image);
        this._failed.delete(key);
        resolve(true);
      });

      image.addEventListener("error", () => {
        this._images.delete(key);
        this._failed.add(key);
        console.warn(`Failed to load UI asset '${key}': ${path}`);
        resolve(false);
      });

      image.src = path;
    });
  }

  static image(key) {
    const image = this._images.get(key) || null;

    if (!image || image.complete === false) {
      return null;
    }

    if ("naturalWidth" in image && image.naturalWidth <= 0) {
      return null;
    }

    return image;
  }

  static isReady(key) {
    return this.image(key) !== null;
  }

  static hasFailed(key) {
    return this._failed.has(key);
  }

  static summary() {
    return {
      initialized: this._initialized,
      ready: Object.keys(this._manifest).filter((key) => this.isReady(key)),
      failed: [...this._failed],
    };
  }

  static drawImage(key, context, ...args) {
    const image = this.image(key);

    if (!image || !context || typeof context.drawImage !== "function") {
      return false;
    }

    context.drawImage(image, ...args);
    return true;
  }

  static drawWindowSkin(
    context,
    x,
    y,
    width,
    height,
    { alpha = 1, drawBackground = true, drawFrame = true } = {},
  ) {
    const image = this.image("windowSkin");

    if (
      !image ||
      !context ||
      typeof context.drawImage !== "function" ||
      width <= 0 ||
      height <= 0
    ) {
      return false;
    }

    const frameSize = this.WINDOW_SKIN_FRAME_SIZE;
    const margin = Math.min(
      this.WINDOW_SKIN_FRAME_MARGIN,
      width / 2,
      height / 2,
    );

    context.save?.();
    const previousAlpha = Number.isFinite(context.globalAlpha)
      ? context.globalAlpha
      : 1;
    context.globalAlpha = previousAlpha * Math.max(0, Math.min(1, alpha));

    if (drawBackground) {
      context.drawImage(
        image,
        0,
        0,
        frameSize,
        frameSize,
        x + margin,
        y + margin,
        Math.max(0, width - margin * 2),
        Math.max(0, height - margin * 2),
      );
    }

    if (drawFrame) {
      const sx = frameSize;
      const sy = 0;
      const sourceMargin = this.WINDOW_SKIN_FRAME_MARGIN;
      const sourceMiddle = frameSize - sourceMargin * 2;
      const destMiddleWidth = Math.max(0, width - margin * 2);
      const destMiddleHeight = Math.max(0, height - margin * 2);

      // Corners.
      context.drawImage(
        image,
        sx,
        sy,
        sourceMargin,
        sourceMargin,
        x,
        y,
        margin,
        margin,
      );
      context.drawImage(
        image,
        sx + frameSize - sourceMargin,
        sy,
        sourceMargin,
        sourceMargin,
        x + width - margin,
        y,
        margin,
        margin,
      );
      context.drawImage(
        image,
        sx,
        sy + frameSize - sourceMargin,
        sourceMargin,
        sourceMargin,
        x,
        y + height - margin,
        margin,
        margin,
      );
      context.drawImage(
        image,
        sx + frameSize - sourceMargin,
        sy + frameSize - sourceMargin,
        sourceMargin,
        sourceMargin,
        x + width - margin,
        y + height - margin,
        margin,
        margin,
      );

      // Edges.
      context.drawImage(
        image,
        sx + sourceMargin,
        sy,
        sourceMiddle,
        sourceMargin,
        x + margin,
        y,
        destMiddleWidth,
        margin,
      );
      context.drawImage(
        image,
        sx + sourceMargin,
        sy + frameSize - sourceMargin,
        sourceMiddle,
        sourceMargin,
        x + margin,
        y + height - margin,
        destMiddleWidth,
        margin,
      );
      context.drawImage(
        image,
        sx,
        sy + sourceMargin,
        sourceMargin,
        sourceMiddle,
        x,
        y + margin,
        margin,
        destMiddleHeight,
      );
      context.drawImage(
        image,
        sx + frameSize - sourceMargin,
        sy + sourceMargin,
        sourceMargin,
        sourceMiddle,
        x + width - margin,
        y + margin,
        margin,
        destMiddleHeight,
      );
    }

    context.restore?.();
    return true;
  }

  static drawIcon(context, iconIndex, x, y, size = this.ICON_SIZE) {
    const image = this.image("iconSet");
    const index = Number(iconIndex);

    if (
      !image ||
      !context ||
      typeof context.drawImage !== "function" ||
      !Number.isInteger(index) ||
      index < 0 ||
      !Number.isFinite(size) ||
      size <= 0
    ) {
      return false;
    }

    const sourceX = (index % this.ICON_COLUMNS) * this.ICON_SIZE;
    const sourceY = Math.floor(index / this.ICON_COLUMNS) * this.ICON_SIZE;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      this.ICON_SIZE,
      this.ICON_SIZE,
      x,
      y,
      size,
      size,
    );

    return true;
  }

  static drawBattleShadow(
    context,
    x,
    y,
    { scale = 1, alpha = 0.55, width = 82, height = 38 } = {},
  ) {
    const image = this.image("battleShadow");

    if (
      !image ||
      !context ||
      typeof context.drawImage !== "function" ||
      !Number.isFinite(scale) ||
      scale <= 0
    ) {
      return false;
    }

    const drawWidth = width * scale;
    const drawHeight = height * scale;

    context.save?.();
    const previousAlpha = Number.isFinite(context.globalAlpha)
      ? context.globalAlpha
      : 1;
    context.globalAlpha =
      previousAlpha * Math.max(0, Math.min(1, Number(alpha) || 0));
    context.drawImage(
      image,
      x - drawWidth / 2,
      y - drawHeight / 2,
      drawWidth,
      drawHeight,
    );
    context.restore?.();
    return true;
  }
}
