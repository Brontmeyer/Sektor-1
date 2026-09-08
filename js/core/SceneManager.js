"use strict";

class SceneManager {
  static initialize() {
    this.currentScene = null;

    this.sceneStack = [];

    console.log("SceneManager initialized.");
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

    console.log("Scene changed to:", sceneClass.name);
  }

  static push(sceneClass) {
    if (this.currentScene) {
      this.sceneStack.push(this.currentScene);
    }

    this.currentScene = new sceneClass();

    console.log(`Scene pushed: ${sceneClass.name}`);
  }

  static pop() {
    if (this.sceneStack.length === 0) {
      console.warn("SceneManager.pop(): scene stack is empty.");

      return;
    }

    this.currentScene = this.sceneStack.pop();

    console.log(`Returned to scene: ${this.currentScene.constructor.name}`);
  }
}
