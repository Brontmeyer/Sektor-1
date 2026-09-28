"use strict";

class BattleBackgroundManager {
  static FALLBACK_COLOR = "#202020";

  constructor(scene, battleContext = null) {
    this.scene = scene;
    this.battleContext = battleContext && typeof battleContext === "object"
      ? { ...battleContext }
      : {};
    this.key = this.resolveBackgroundKey();
    this.definition = this.resolveDefinition(this.key);
    this.image = null;
    this.loadFailed = false;

    this.loadImage();
  }

  resolveBackgroundKey() {
    const encounterKey = this.scene?.encounter?.battleBackgroundKey;
    if (typeof encounterKey === "string" && encounterKey.trim()) {
      return encounterKey.trim();
    }

    const mapKey = this.battleContext?.battleBackgroundKey;
    if (typeof mapKey === "string" && mapKey.trim()) {
      return mapKey.trim();
    }

    const defaultKey =
      typeof DatabaseManager !== "undefined"
        ? DatabaseManager.system?.defaultBattleBackgroundKey
        : null;
    return typeof defaultKey === "string" && defaultKey.trim()
      ? defaultKey.trim()
      : null;
  }

  resolveDefinition(key) {
    if (
      !key ||
      typeof DatabaseManager === "undefined" ||
      typeof DatabaseManager.battleBackgroundByKey !== "function"
    ) {
      return null;
    }

    return DatabaseManager.battleBackgroundByKey(key);
  }

  fallbackColor() {
    const color = this.definition?.fallbackColor;
    return typeof color === "string" && color.trim()
      ? color.trim()
      : BattleBackgroundManager.FALLBACK_COLOR;
  }

  imagePath() {
    const path = this.definition?.image;
    return typeof path === "string" && path.trim() ? path.trim() : null;
  }

  loadImage() {
    const path = this.imagePath();
    if (!path || typeof Image !== "function") {
      return false;
    }

    const image = new Image();
    image.loadFailed = false;
    image.onerror = () => {
      image.loadFailed = true;
      this.loadFailed = true;
      console.warn(
        `Failed to load battle background '${this.key || "unknown"}': ${path}`,
      );
    };
    image.onload = () => {
      image.loadFailed = false;
      this.loadFailed = false;
    };
    image.src = path;
    this.image = image;
    return true;
  }

  imageReady() {
    const image = this.image;
    if (!image || image.loadFailed || image.complete === false) {
      return false;
    }

    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);
    return width > 0 && height > 0;
  }

  normalizedAnchor(value, fallback = 0.5) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(0, Math.min(1, number))
      : fallback;
  }

  coverSourceRect(image, width, height) {
    const sourceWidth = Number(image?.naturalWidth || image?.width || 0);
    const sourceHeight = Number(image?.naturalHeight || image?.height || 0);
    const destinationWidth = Math.max(1, Number(width) || 1);
    const destinationHeight = Math.max(1, Number(height) || 1);

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return null;
    }

    const sourceAspect = sourceWidth / sourceHeight;
    const destinationAspect = destinationWidth / destinationHeight;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    if (sourceAspect > destinationAspect) {
      cropWidth = sourceHeight * destinationAspect;
    } else if (sourceAspect < destinationAspect) {
      cropHeight = sourceWidth / destinationAspect;
    }

    const anchorX = this.normalizedAnchor(this.definition?.positionX, 0.5);
    const anchorY = this.normalizedAnchor(this.definition?.positionY, 0.5);

    return {
      x: (sourceWidth - cropWidth) * anchorX,
      y: (sourceHeight - cropHeight) * anchorY,
      width: cropWidth,
      height: cropHeight,
    };
  }

  draw(context, width, height) {
    if (!context) {
      return false;
    }

    const destinationWidth = Math.max(1, Number(width) || 1);
    const destinationHeight = Math.max(1, Number(height) || 1);

    context.fillStyle = this.fallbackColor();
    context.fillRect(0, 0, destinationWidth, destinationHeight);

    if (!this.imageReady() || typeof context.drawImage !== "function") {
      return false;
    }

    const source = this.coverSourceRect(
      this.image,
      destinationWidth,
      destinationHeight,
    );
    if (!source) {
      return false;
    }

    context.drawImage(
      this.image,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      destinationWidth,
      destinationHeight,
    );
    return true;
  }
}
