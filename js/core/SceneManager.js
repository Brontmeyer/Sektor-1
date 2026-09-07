"use strict";

class SceneManager {
  static initialize() {
    this.currentScene = null;

    console.log("SceneManager initialized.");
  }

  static goto(sceneClass) {
    if (this.currentScene) {
      this.currentScene.terminate();
    }

    this.currentScene = new sceneClass();

    this.currentScene.start();

    console.log("Scene changed to:", sceneClass.name);
  }

  static update(deltaTime) {
    if (!this.currentScene) {
      return;
    }

    this.currentScene.update(deltaTime);
  }

  static draw() {
    if (!this.currentScene) {
      return;
    }

    this.currentScene.draw();
  }
}
