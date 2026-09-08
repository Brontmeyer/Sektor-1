"use strict";

class Game_Player {
  constructor(gameMap) {
    this.map = gameMap;

    this.x = this.map.playerStart.x;

    this.y = this.map.playerStart.y;

    this.width = 32;
    this.height = 32;

    this.velocityX = 0;
    this.velocityY = 0;

    this.acceleration = 900;
    this.deceleration = 1100;

    this.maxSpeed = 250;
  }

  update(deltaTime) {
    let inputX = 0;
    let inputY = 0;

    if (Input.isPressed("KeyA") || Input.isPressed("ArrowLeft")) {
      inputX -= 1;
    }

    if (Input.isPressed("KeyD") || Input.isPressed("ArrowRight")) {
      inputX += 1;
    }

    if (Input.isPressed("KeyW") || Input.isPressed("ArrowUp")) {
      inputY -= 1;
    }

    if (Input.isPressed("KeyS") || Input.isPressed("ArrowDown")) {
      inputY += 1;
    }

    this.updateVelocity(inputX, inputY, deltaTime);
    this.updatePosition(deltaTime);
  }

  updatePosition(deltaTime) {
    const moveX = this.velocityX * deltaTime;

    const moveY = this.velocityY * deltaTime;

    CollisionManager.moveX(this, moveX, this.map.obstacles);

    CollisionManager.moveY(this, moveY, this.map.obstacles);

    this.keepInsideMap();
  }

  updateVelocity(inputX, inputY, deltaTime) {
    if (inputX !== 0 || inputY !== 0) {
      const length = Math.sqrt(inputX * inputX + inputY * inputY);

      inputX /= length;
      inputY /= length;

      this.velocityX += inputX * this.acceleration * deltaTime;
      this.velocityY += inputY * this.acceleration * deltaTime;

      const speed = Math.sqrt(
        this.velocityX * this.velocityX + this.velocityY * this.velocityY,
      );

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
    const speed = Math.sqrt(
      this.velocityX * this.velocityX + this.velocityY * this.velocityY,
    );

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
    Graphics.context.fillStyle = "white";

    Graphics.context.fillRect(
      this.x - cameraX,
      this.y - cameraY,
      this.width,
      this.height,
    );
  }
}
