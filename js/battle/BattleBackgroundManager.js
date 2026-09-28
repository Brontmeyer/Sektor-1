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
    this.layers = [];
    this.image = null;
    this.loadFailed = false;

    this.loadImages();
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

  normalizedAnchor(value, fallback = 0.5) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(0, Math.min(1, number))
      : fallback;
  }

  layerDefinitions() {
    if (Array.isArray(this.definition?.layers) && this.definition.layers.length > 0) {
      return this.definition.layers;
    }

    const path = this.definition?.image;
    if (typeof path !== "string" || !path.trim()) {
      return [];
    }

    return [
      {
        image: path.trim(),
        positionX: this.definition?.positionX,
        positionY: this.definition?.positionY,
      },
    ];
  }

  loadImages() {
    const definitions = this.layerDefinitions();
    if (definitions.length === 0 || typeof Image !== "function") {
      return false;
    }

    this.layers = definitions.map((definition, index) => {
      const path = typeof definition?.image === "string"
        ? definition.image.trim()
        : "";
      const image = new Image();
      const state = {
        definition,
        image,
        loadFailed: false,
      };

      image.loadFailed = false;
      image.onerror = () => {
        image.loadFailed = true;
        state.loadFailed = true;
        this.loadFailed = this.layers.some((layer) => layer.loadFailed === true);
        console.warn(
          `Failed to load battle background '${this.key || "unknown"}' layer ${index + 1}: ${path || "unknown asset"}`,
        );
      };
      image.onload = () => {
        image.loadFailed = false;
        state.loadFailed = false;
        this.loadFailed = this.layers.some((layer) => layer.loadFailed === true);
      };
      image.src = path;
      return state;
    });

    // Keep the original single-image surface available for compatibility with
    // existing diagnostics/tests while layered definitions use `layers`.
    this.image = this.layers.length === 1 ? this.layers[0].image : null;
    return this.layers.length > 0;
  }

  imageReady(image) {
    if (!image || image.loadFailed || image.complete === false) {
      return false;
    }

    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);
    return width > 0 && height > 0;
  }

  coverSourceRect(image, width, height, definition = this.definition) {
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

    const anchorX = this.normalizedAnchor(definition?.positionX, 0.5);
    const anchorY = this.normalizedAnchor(definition?.positionY, 0.5);

    return {
      x: (sourceWidth - cropWidth) * anchorX,
      y: (sourceHeight - cropHeight) * anchorY,
      width: cropWidth,
      height: cropHeight,
    };
  }

  drawImageLayer(context, image, definition, width, height) {
    if (!this.imageReady(image) || typeof context.drawImage !== "function") {
      return false;
    }

    const source = this.coverSourceRect(image, width, height, definition);
    if (!source) {
      return false;
    }

    context.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      width,
      height,
    );
    return true;
  }

  draw(context, width, height) {
    if (!context) {
      return false;
    }

    const destinationWidth = Math.max(1, Number(width) || 1);
    const destinationHeight = Math.max(1, Number(height) || 1);

    context.fillStyle = this.fallbackColor();
    context.fillRect(0, 0, destinationWidth, destinationHeight);

    let drewImage = false;

    if (this.layers.length > 0) {
      for (const layer of this.layers) {
        drewImage =
          this.drawImageLayer(
            context,
            layer.image,
            layer.definition,
            destinationWidth,
            destinationHeight,
          ) || drewImage;
      }
      return drewImage;
    }

    // Compatibility path for a manually supplied single image in diagnostics.
    return this.drawImageLayer(
      context,
      this.image,
      this.definition,
      destinationWidth,
      destinationHeight,
    );
  }
}
