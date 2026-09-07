"use strict";

class GameLoop {
  static start() {
    this.running = true;

    this.lastTime = performance.now();

    requestAnimationFrame(this.loop.bind(this));

    console.log("Game loop started.");
  }

  static loop(currentTime) {
    if (!this.running) {
      return;
    }

    const deltaMilliseconds = currentTime - this.lastTime;

    this.lastTime = currentTime;

    const deltaTime = deltaMilliseconds / 1000;

    this.update(deltaTime);

    requestAnimationFrame(this.loop.bind(this));
  }

  static update(deltaTime) {
    Graphics.clear();

    SceneManager.update(deltaTime);

    SceneManager.draw();
    Input.endFrame();
  }

  static stop() {
    this.running = false;
  }
}
