"use strict";

class Camera {
  constructor(map) {
    this.map = map;

    this.x = 0;
    this.y = 0;
  }

  clampToMap() {
    const maxX = Math.max(0, this.map.width - Graphics.width);
    const maxY = Math.max(0, this.map.height - Graphics.height);

    this.x = Math.max(0, Math.min(this.x, maxX));
    this.y = Math.max(0, Math.min(this.y, maxY));
  }

  follow(target) {
    this.x = target.x + target.width / 2 - Graphics.width / 2;

    this.y = target.y + target.height / 2 - Graphics.height / 2;

    this.clampToMap();
  }
}
