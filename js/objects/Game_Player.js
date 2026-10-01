"use strict";

class Game_Player {
  static FIELD_DIRECTIONS = [
    "down",
    "downLeft",
    "left",
    "upLeft",
    "up",
    "upRight",
    "right",
    "downRight",
  ];

  static directionForVector(x, y, fallback = "down") {
    const vx = Number(x) || 0;
    const vy = Number(y) || 0;

    if (Math.hypot(vx, vy) < 0.001) {
      return Game_Player.FIELD_DIRECTIONS.includes(fallback) ? fallback : "down";
    }

    const octant = ((Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) % 8) + 8) % 8;
    const byOctant = [
      "right",
      "downRight",
      "down",
      "downLeft",
      "left",
      "upLeft",
      "up",
      "upRight",
    ];

    return byOctant[octant];
  }

  constructor(gameMap) {
    this.map = gameMap;

    this.x = this.map.playerStart.x;
    this.y = this.map.playerStart.y;

    // Field collision remains independent from artwork dimensions. Production
    // sprites anchor to this box instead of redefining map collision behavior.
    this.width = 32;
    this.height = 32;

    this.velocityX = 0;
    this.velocityY = 0;

    this.acceleration = 900;
    this.deceleration = 1100;

    this.maxSpeed = 250;

    // Field presentation state. The current white square remains a guaranteed
    // fallback until an actor receives a fieldVisual profile and sprite asset.
    this.fieldDirection = "down";
    this.fieldAnimationIndex = 0;
    this.fieldAnimationTimer = 0;
    this.fieldSpriteImage = null;
    this.fieldSpritePath = "";
  }

  update(deltaTime) {
    let inputX = 0;
    let inputY = 0;

    if (Input.isActionPressed("left")) {
      inputX -= 1;
    }

    if (Input.isActionPressed("right")) {
      inputX += 1;
    }

    if (Input.isActionPressed("up")) {
      inputY -= 1;
    }

    if (Input.isActionPressed("down")) {
      inputY += 1;
    }

    this.updateVelocity(inputX, inputY, deltaTime);
    this.updatePosition(deltaTime);
    this.updateFieldAnimation(deltaTime);
  }

  updatePosition(deltaTime) {
    const moveX = this.velocityX * deltaTime;
    const moveY = this.velocityY * deltaTime;
    const obstacles = this.map.getCollisionObstacles();

    CollisionManager.moveX(this, moveX, obstacles);
    CollisionManager.moveY(this, moveY, obstacles);

    this.keepInsideMap();
  }

  updateVelocity(inputX, inputY, deltaTime) {
    if (inputX !== 0 || inputY !== 0) {
      const length = Math.sqrt(inputX * inputX + inputY * inputY);

      inputX /= length;
      inputY /= length;

      this.velocityX += inputX * this.acceleration * deltaTime;
      this.velocityY += inputY * this.acceleration * deltaTime;

      const speed = Math.hypot(this.velocityX, this.velocityY);

      if (speed > this.maxSpeed) {
        const scale = this.maxSpeed / speed;

        this.velocityX *= scale;
        this.velocityY *= scale;
      }
    } else {
      this.applyDeceleration(deltaTime);
    }
  }

  applyDeceleration(deltaTime) {
    const speed = Math.hypot(this.velocityX, this.velocityY);

    if (speed === 0) {
      return;
    }

    const newSpeed = Math.max(0, speed - this.deceleration * deltaTime);

    if (newSpeed === 0) {
      this.velocityX = 0;
      this.velocityY = 0;
      return;
    }

    const scale = newSpeed / speed;

    this.velocityX *= scale;
    this.velocityY *= scale;
  }

  fieldActor() {
    return globalThis.$gameParty?.leader?.() || null;
  }

  fieldVisualProfile() {
    const profile = this.fieldActor()?.fieldVisual;

    if (!profile?.sprite) {
      return null;
    }

    return profile;
  }

  fieldSpeed() {
    return Math.hypot(this.velocityX, this.velocityY);
  }

  fieldFrameDuration(profile, speed = this.fieldSpeed()) {
    const animation = profile?.animation || {};
    const fast = Math.max(0.001, Number(animation.fastFrameDuration) || 0.1);
    const slow = Math.max(fast, Number(animation.slowFrameDuration) || 0.22);
    const ratio = Math.max(0, Math.min(1, speed / Math.max(1, this.maxSpeed)));

    return slow + (fast - slow) * ratio;
  }

  updateFieldAnimation(deltaTime) {
    const profile = this.fieldVisualProfile();
    const speed = this.fieldSpeed();
    const minimumSpeed = Math.max(
      0,
      Number(profile?.animation?.minimumSpeed) || 1,
    );

    if (speed <= minimumSpeed) {
      this.fieldAnimationIndex = 0;
      this.fieldAnimationTimer = 0;
      return;
    }

    // Facing follows actual post-collision velocity. This lets diagonal movement
    // become cardinal naturally when one collision component is blocked, and it
    // preserves the moving direction while acceleration/deceleration is active.
    this.fieldDirection = Game_Player.directionForVector(
      this.velocityX,
      this.velocityY,
      this.fieldDirection,
    );

    if (!profile) {
      return;
    }

    const walkFrames = profile.animation?.walkFrames || [0, 1, 2, 3];

    if (walkFrames.length <= 1) {
      this.fieldAnimationIndex = 0;
      this.fieldAnimationTimer = 0;
      return;
    }

    this.fieldAnimationTimer += Math.max(0, Number(deltaTime) || 0);
    const frameDuration = this.fieldFrameDuration(profile, speed);

    while (this.fieldAnimationTimer >= frameDuration) {
      this.fieldAnimationTimer -= frameDuration;
      this.fieldAnimationIndex =
        (this.fieldAnimationIndex + 1) % walkFrames.length;
    }
  }

  currentFieldFrame(profile) {
    const animation = profile?.animation || {};
    const walkFrames = Array.isArray(animation.walkFrames)
      ? animation.walkFrames
      : [0, 1, 2, 3];
    const minimumSpeed = Math.max(0, Number(animation.minimumSpeed) || 1);

    if (this.fieldSpeed() <= minimumSpeed || walkFrames.length === 0) {
      return Math.max(0, Number(animation.idleFrame) || 0);
    }

    const index = this.fieldAnimationIndex % walkFrames.length;
    return Math.max(0, Number(walkFrames[index]) || 0);
  }

  currentFieldRow(profile) {
    const directions = profile?.sheet?.directions || {};
    const row = Number(directions[this.fieldDirection]);

    return Number.isInteger(row) && row >= 0 ? row : 0;
  }

  fieldSpriteAssetPath(profile) {
    return `js/sprites/actors/field/${profile.sprite}`;
  }

  ensureFieldSprite(profile) {
    if (!profile || typeof Image === "undefined") {
      return null;
    }

    const path = this.fieldSpriteAssetPath(profile);

    if (this.fieldSpriteImage && this.fieldSpritePath === path) {
      return this.fieldSpriteImage;
    }

    const image = new Image();
    image.loadFailed = false;
    image.onerror = () => {
      image.loadFailed = true;
      console.warn(`Failed to load field sprite: ${path}`);
    };
    image.onload = () => {
      image.loadFailed = false;
    };
    image.src = path;

    this.fieldSpriteImage = image;
    this.fieldSpritePath = path;

    return image;
  }

  fieldSpriteReady(image) {
    return Boolean(
      image &&
        !image.loadFailed &&
        image.complete !== false &&
        Number(image.naturalWidth || image.width) > 0,
    );
  }

  drawFieldSprite(profile, cameraX, cameraY) {
    const image = this.ensureFieldSprite(profile);

    if (!this.fieldSpriteReady(image)) {
      return false;
    }

    const frameWidth = Math.max(1, Number(profile.frameWidth) || 32);
    const frameHeight = Math.max(1, Number(profile.frameHeight) || 32);
    const scale = Math.max(0.01, Number(profile.scale) || 1);
    const frame = this.currentFieldFrame(profile);
    const row = this.currentFieldRow(profile);
    const drawWidth = frameWidth * scale;
    const drawHeight = frameHeight * scale;
    const anchorX = Number.isFinite(Number(profile.anchor?.x))
      ? Number(profile.anchor.x)
      : 0.5;
    const anchorY = Number.isFinite(Number(profile.anchor?.y))
      ? Number(profile.anchor.y)
      : 1;
    const offsetX = Number(profile.offset?.x) || 0;
    const offsetY = Number(profile.offset?.y) || 0;

    // Ground the art on the bottom-center of the existing collision box. Sprite
    // dimensions can therefore grow without altering movement/collision rules.
    const worldAnchorX = this.x + this.width / 2;
    const worldAnchorY = this.y + this.height;
    const drawX = worldAnchorX - cameraX - drawWidth * anchorX + offsetX;
    const drawY = worldAnchorY - cameraY - drawHeight * anchorY + offsetY;

    Graphics.context.drawImage(
      image,
      frame * frameWidth,
      row * frameHeight,
      frameWidth,
      frameHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );

    return true;
  }

  drawFallback(cameraX, cameraY) {
    Graphics.context.fillStyle = "white";
    Graphics.context.fillRect(
      this.x - cameraX,
      this.y - cameraY,
      this.width,
      this.height,
    );
  }

  keepInsideMap() {
    const maxX = this.map.width - this.width;
    const maxY = this.map.height - this.height;

    if (this.x < 0) {
      this.x = 0;
      this.velocityX = 0;
    }

    if (this.x > maxX) {
      this.x = maxX;
      this.velocityX = 0;
    }

    if (this.y < 0) {
      this.y = 0;
      this.velocityY = 0;
    }

    if (this.y > maxY) {
      this.y = maxY;
      this.velocityY = 0;
    }
  }

  draw(cameraX, cameraY) {
    const profile = this.fieldVisualProfile();

    if (profile && this.drawFieldSprite(profile, cameraX, cameraY)) {
      return;
    }

    this.drawFallback(cameraX, cameraY);
  }
}
