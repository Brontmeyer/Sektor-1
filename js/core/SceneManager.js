"use strict";

class SceneManager {
  static initialize() {
    this.currentScene = null;

    this.sceneStack = [];

    DebugManager.log("SceneManager initialized.");
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

  static goto(sceneClass) {
    if (this.currentScene) {
      this.currentScene.terminate();
    }

    this.currentScene = new sceneClass();

    this.currentScene.start();

    DebugManager.log("Scene changed to:", sceneClass.name);
  }

  static push(sceneClass) {
    if (this.currentScene) {
      this.sceneStack.push(this.currentScene);
    }

    this.currentScene = new sceneClass();

    this.currentScene.start();

    DebugManager.log(`Scene pushed: ${sceneClass.name}`);
  }

  static pop() {
    if (this.sceneStack.length === 0) {
      console.warn("SceneManager.pop(): scene stack is empty.");

      return;
    }

    if (this.currentScene) {
      this.currentScene.terminate();
    }

    this.currentScene = this.sceneStack.pop();

    DebugManager.log(`Returned to scene: ${this.currentScene.constructor.name}`);
  }
}
