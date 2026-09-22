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

    // Pass 55 - UI Style Integration Prototype v1
    // Consumers request semantic roles. Actual source filenames stay here so
    // the visual skin can be swapped later without editing gameplay windows.
    battlePanel: "js/sprites/ui/adventure/panel_grey_blue.png",
    menuPanel: "js/sprites/ui/adventure/panel_grey_dark.png",
    accentPanel: "js/sprites/ui/adventure/panel_grey_bolts_blue.png",
    selectionPanel: "js/sprites/ui/adventure/button_grey.png",
    gaugeFrame: "js/sprites/ui/adventure/progress_transparent.png",
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

  static clampAlpha(value, fallback = 1) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return Math.max(0, Math.min(1, number));
  }

  static drawNineSlice(
    key,
    context,
    x,
    y,
    width,
    height,
    {
      sourceMargin = 12,
      destMargin = sourceMargin,
      alpha = 1,
      drawCenter = true,
    } = {},
  ) {
    const image = this.image(key);

    if (
      !image ||
      !context ||
      typeof context.drawImage !== "function" ||
      width <= 0 ||
      height <= 0
    ) {
      return false;
    }

    const sourceWidth = Number(image.naturalWidth || image.width || 0);
    const sourceHeight = Number(image.naturalHeight || image.height || 0);

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return false;
    }

    const sxMargin = Math.max(
      0,
      Math.min(Number(sourceMargin) || 0, sourceWidth / 2, sourceHeight / 2),
    );
    const dxMargin = Math.max(
      0,
      Math.min(Number(destMargin) || 0, width / 2, height / 2),
    );
    const sourceMiddleWidth = Math.max(0, sourceWidth - sxMargin * 2);
    const sourceMiddleHeight = Math.max(0, sourceHeight - sxMargin * 2);
    const destMiddleWidth = Math.max(0, width - dxMargin * 2);
    const destMiddleHeight = Math.max(0, height - dxMargin * 2);

    context.save?.();
    const previousAlpha = Number.isFinite(context.globalAlpha)
      ? context.globalAlpha
      : 1;
    context.globalAlpha = previousAlpha * this.clampAlpha(alpha);

    if (drawCenter && sourceMiddleWidth > 0 && sourceMiddleHeight > 0) {
      context.drawImage(
        image,
        sxMargin,
        sxMargin,
        sourceMiddleWidth,
        sourceMiddleHeight,
        x + dxMargin,
        y + dxMargin,
        destMiddleWidth,
        destMiddleHeight,
      );
    }

    // Corners.
    context.drawImage(image, 0, 0, sxMargin, sxMargin, x, y, dxMargin, dxMargin);
    context.drawImage(
      image,
      sourceWidth - sxMargin,
      0,
      sxMargin,
      sxMargin,
      x + width - dxMargin,
      y,
      dxMargin,
      dxMargin,
    );
    context.drawImage(
      image,
      0,
      sourceHeight - sxMargin,
      sxMargin,
      sxMargin,
      x,
      y + height - dxMargin,
      dxMargin,
      dxMargin,
    );
    context.drawImage(
      image,
      sourceWidth - sxMargin,
      sourceHeight - sxMargin,
      sxMargin,
      sxMargin,
      x + width - dxMargin,
      y + height - dxMargin,
      dxMargin,
      dxMargin,
    );

    // Edges.
    if (sourceMiddleWidth > 0 && destMiddleWidth > 0) {
      context.drawImage(
        image,
        sxMargin,
        0,
        sourceMiddleWidth,
        sxMargin,
        x + dxMargin,
        y,
        destMiddleWidth,
        dxMargin,
      );
      context.drawImage(
        image,
        sxMargin,
        sourceHeight - sxMargin,
        sourceMiddleWidth,
        sxMargin,
        x + dxMargin,
        y + height - dxMargin,
        destMiddleWidth,
        dxMargin,
      );
    }

    if (sourceMiddleHeight > 0 && destMiddleHeight > 0) {
      context.drawImage(
        image,
        0,
        sxMargin,
        sxMargin,
        sourceMiddleHeight,
        x,
        y + dxMargin,
        dxMargin,
        destMiddleHeight,
      );
      context.drawImage(
        image,
        sourceWidth - sxMargin,
        sxMargin,
        sxMargin,
        sourceMiddleHeight,
        x + width - dxMargin,
        y + dxMargin,
        dxMargin,
        destMiddleHeight,
      );
    }

    context.restore?.();
    return true;
  }

  static drawPanel(
    context,
    role,
    x,
    y,
    width,
    height,
    {
      fallbackFill = "rgba(9, 13, 18, 0.94)",
      fallbackStroke = "rgba(151, 196, 229, 0.55)",
      lineWidth = 1.5,
      assetAlpha = 0.5,
      sourceMargin = 12,
      destMargin = 12,
    } = {},
  ) {
    if (!context || width <= 0 || height <= 0) {
      return false;
    }

    context.save?.();

    if (fallbackFill && typeof context.fillRect === "function") {
      context.fillStyle = fallbackFill;
      context.fillRect(x, y, width, height);
    }

    if (fallbackStroke && typeof context.strokeRect === "function") {
      context.strokeStyle = fallbackStroke;
      context.lineWidth = lineWidth;
      context.strokeRect(x, y, width, height);
    }

    context.restore?.();

    return this.drawNineSlice(role, context, x, y, width, height, {
      sourceMargin,
      destMargin,
      alpha: assetAlpha,
    });
  }

  static drawSelectionPanel(
    context,
    x,
    y,
    width,
    height,
    { alpha = 0.24 } = {},
  ) {
    return this.drawNineSlice("selectionPanel", context, x, y, width, height, {
      sourceMargin: 7,
      destMargin: Math.min(9, Math.max(4, height / 4)),
      alpha,
    });
  }

  static drawHorizontalImage(
    key,
    context,
    x,
    y,
    width,
    height,
    { alpha = 1 } = {},
  ) {
    const image = this.image(key);

    if (
      !image ||
      !context ||
      typeof context.drawImage !== "function" ||
      width <= 0 ||
      height <= 0
    ) {
      return false;
    }

    context.save?.();
    const previousAlpha = Number.isFinite(context.globalAlpha)
      ? context.globalAlpha
      : 1;
    context.globalAlpha = previousAlpha * this.clampAlpha(alpha);
    context.translate?.(x + width, y);
    context.rotate?.(Math.PI / 2);
    context.drawImage(image, 0, 0, height, width);
    context.restore?.();
    return true;
  }

  static drawGauge(
    context,
    value,
    maximum,
    x,
    y,
    width,
    height,
    fillStyle,
  ) {
    if (!context || width <= 0 || height <= 0) {
      return false;
    }

    const max = Number(maximum);
    const current = Number(value);
    const rate =
      Number.isFinite(max) && max > 0 && Number.isFinite(current)
        ? Math.max(0, Math.min(1, current / max))
        : 0;

    // Keep the fill vector-based so HP/MP/Valor retain Sektor 1's palette.
    // The supplied Adventure capsule contributes only soft framing.
    context.save?.();
    context.fillStyle = "rgba(18, 23, 29, 0.82)";
    context.fillRect?.(x, y, width, height);

    if (rate > 0) {
      context.fillStyle = fillStyle;
      context.fillRect?.(
        x + 1,
        y + 1,
        Math.max(0, (width - 2) * rate),
        Math.max(1, height - 2),
      );
    }
    context.restore?.();

    this.drawHorizontalImage("gaugeFrame", context, x, y, width, height, {
      alpha: 0.72,
    });
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
