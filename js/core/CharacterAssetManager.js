"use strict";

class CharacterAssetManager {
  static BASE_PATH = "js/sprites/actors/";
  static _images = new Map();
  static _failed = new Set();

  static normalizeRelativePath(value) {
    const path = String(value || "").trim().replace(/\\/g, "/");

    if (!path || path.startsWith("/") || path.includes("..")) {
      return null;
    }

    return path;
  }

  static assetPath(relativePath) {
    const normalized = this.normalizeRelativePath(relativePath);
    return normalized ? `${this.BASE_PATH}${normalized}` : null;
  }

  static visualProfile(actor) {
    if (actor?.characterVisual) {
      return actor.characterVisual;
    }

    const actorId = Number(actor?.actorId);

    if (
      Number.isInteger(actorId) &&
      actorId > 0 &&
      typeof DatabaseManager !== "undefined" &&
      typeof DatabaseManager.actor === "function"
    ) {
      try {
        return DatabaseManager.actor(actorId)?.characterVisual || null;
      } catch (error) {
        console.warn(`Could not resolve character visuals for actor ${actorId}.`, error);
      }
    }

    return null;
  }

  static portraitRelativePath(actor, expression = "default") {
    const profile = this.visualProfile(actor);

    if (!profile) {
      return null;
    }

    const key = String(expression || "default");
    const expressionPath = profile.expressions?.[key];
    return this.normalizeRelativePath(expressionPath || profile.portrait);
  }

  static portraitPath(actor, expression = "default") {
    return this.assetPath(this.portraitRelativePath(actor, expression));
  }

  static ensureImage(path) {
    if (!path || typeof Image !== "function") {
      return null;
    }

    if (this._images.has(path)) {
      return this._images.get(path);
    }

    const image = new Image();
    image.loadFailed = false;
    image.addEventListener?.("load", () => {
      image.loadFailed = false;
      this._failed.delete(path);
    });
    image.addEventListener?.("error", () => {
      image.loadFailed = true;
      this._failed.add(path);
      console.warn(`Failed to load character asset: ${path}`);
    });

    // Some test/runtime Image shims expose onload/onerror but not
    // addEventListener. Supporting both keeps character assets non-fatal.
    if (typeof image.addEventListener !== "function") {
      image.onload = () => {
        image.loadFailed = false;
        this._failed.delete(path);
      };
      image.onerror = () => {
        image.loadFailed = true;
        this._failed.add(path);
        console.warn(`Failed to load character asset: ${path}`);
      };
    }

    image.src = path;
    this._images.set(path, image);
    return image;
  }

  static imageReady(image) {
    return Boolean(
      image &&
        !image.loadFailed &&
        image.complete !== false &&
        Number(image.naturalWidth || image.width) > 0 &&
        Number(image.naturalHeight || image.height) > 0,
    );
  }

  static drawPortrait(
    context,
    actor,
    x,
    y,
    width,
    height = width,
    { expression = "default", fit = "cover" } = {},
  ) {
    if (!context || typeof context.drawImage !== "function") {
      return false;
    }

    const path = this.portraitPath(actor, expression);
    const image = this.ensureImage(path);

    if (!this.imageReady(image)) {
      return false;
    }

    const sourceWidth = Number(image.naturalWidth || image.width);
    const sourceHeight = Number(image.naturalHeight || image.height);
    const destWidth = Math.max(1, Number(width) || 1);
    const destHeight = Math.max(1, Number(height) || destWidth);
    const destRatio = destWidth / destHeight;
    const sourceRatio = sourceWidth / sourceHeight;

    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (fit === "cover") {
      if (sourceRatio > destRatio) {
        sw = sourceHeight * destRatio;
        sx = (sourceWidth - sw) / 2;
      } else if (sourceRatio < destRatio) {
        sh = sourceWidth / destRatio;
        sy = (sourceHeight - sh) / 2;
      }
    }

    context.save?.();
    context.beginPath?.();
    context.rect?.(x, y, destWidth, destHeight);
    context.clip?.();
    context.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      x,
      y,
      destWidth,
      destHeight,
    );
    context.restore?.();
    return true;
  }
}
