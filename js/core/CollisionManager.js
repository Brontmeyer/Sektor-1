"use strict";

class CollisionManager {
  static intersects(x, y, width, height, rectangle) {
    return (
      x < rectangle.x + rectangle.width &&
      x + width > rectangle.x &&
      y < rectangle.y + rectangle.height &&
      y + height > rectangle.y
    );
  }

  static moveX(character, amount, obstacles) {
    if (amount === 0) {
      return;
    }

    character.x += amount;

    for (const obstacle of obstacles) {
      if (
        this.intersects(
          character.x,
          character.y,
          character.width,
          character.height,
          obstacle,
        )
      ) {
        if (amount > 0) {
          character.x = obstacle.x - character.width;
        } else {
          character.x = obstacle.x + obstacle.width;
        }

        character.velocityX = 0;
      }
    }
  }

  static moveY(character, amount, obstacles) {
    if (amount === 0) {
      return;
    }

    character.y += amount;

    for (const obstacle of obstacles) {
      if (
        this.intersects(
          character.x,
          character.y,
          character.width,
          character.height,
          obstacle,
        )
      ) {
        if (amount > 0) {
          character.y = obstacle.y - character.height;
        } else {
          character.y = obstacle.y + obstacle.height;
        }

        character.velocityY = 0;
      }
    }
  }
}
