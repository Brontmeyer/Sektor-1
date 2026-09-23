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

    globalThis.$gameSystem?.updatePlayTime?.(deltaTime);
    this.currentScene.update(deltaTime);
  }

  static draw() {
    if (!this.currentScene) {
      return;
    }

    this.currentScene.draw();
  }

  static goto(sceneClass, ...args) {
    if (this.currentScene) {
      this.currentScene.terminate();
    }

    this.currentScene = new sceneClass(...args);

    this.currentScene.start();

    DebugManager.log("Scene changed to:", sceneClass.name);
  }

  static push(sceneClass, ...args) {
    if (this.currentScene) {
      this.sceneStack.push(this.currentScene);
    }

    this.currentScene = new sceneClass(...args);

    this.currentScene.start();

    DebugManager.log(`Scene pushed: ${sceneClass.name}`);
  }

  static startShop(shopData) {
    if (!shopData || !Array.isArray(shopData.goods) || shopData.goods.length === 0) {
      console.error("Cannot start a shop without merchandise.");
      return false;
    }

    this.push(Scene_Shop, shopData);
    return true;
  }

  static startBattle(encounterId, onComplete = null) {
    const encounter = DatabaseManager.encounter(encounterId);

    if (!encounter) {
      console.error(`Cannot start unknown encounter ${encounterId}.`);
      return false;
    }

    this.push(Scene_Battle, encounter, onComplete);
    return true;
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
