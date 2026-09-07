"use strict";

class Scene_Base {
  constructor() {
    this.started = false;
  }

  start() {
    this.started = true;
  }

  update(deltaTime) {
    // Child scenes override this.
  }

  draw() {
    // Child scenes override this.
  }

  terminate() {
    this.started = false;
  }
}
