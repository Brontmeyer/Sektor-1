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
    this.syncAudioForCurrentScene();

    DebugManager.log("Scene changed to:", sceneClass.name);
  }

  static push(sceneClass, ...args) {
    if (this.currentScene) {
      this.sceneStack.push(this.currentScene);
    }

    this.currentScene = new sceneClass(...args);

    this.currentScene.start();
    this.syncAudioForCurrentScene();

    DebugManager.log(`Scene pushed: ${sceneClass.name}`);
  }

  static syncAudioForCurrentScene({ fadeSeconds = 0.35 } = {}) {
    if (typeof AudioManager === "undefined") {
      return false;
    }

    const scenes = [
      this.currentScene,
      ...(Array.isArray(this.sceneStack) ? [...this.sceneStack].reverse() : []),
    ];
    let key;

    for (const scene of scenes) {
      if (typeof scene?.audioBgmKey !== "function") {
        continue;
      }
      const candidate = scene.audioBgmKey();
      if (candidate !== undefined) {
        key = candidate;
        break;
      }
    }

    if (key === undefined) {
      return false;
    }
    if (key === null || key === "") {
      return AudioManager.stopBgm?.({ fadeSeconds }) === true;
    }
    return AudioManager.playBgm?.(key, { fadeSeconds }) === true;
  }

  static startShop(shopData) {
    if (!shopData || !Array.isArray(shopData.goods) || shopData.goods.length === 0) {
      console.error("Cannot start a shop without merchandise.");
      return false;
    }

    this.push(Scene_Shop, shopData);
    return true;
  }

  static battleContextForCurrentScene() {
    const map = this.currentScene?.map || null;

    return {
      mapId: Number.isInteger(map?.id) ? map.id : null,
      mapName: typeof map?.name === "string" ? map.name : null,
      battleBackgroundKey:
        typeof map?.battleBackgroundKey === "string"
          ? map.battleBackgroundKey
          : null,
    };
  }

  static startBattle(encounterId, onComplete = null) {
    const encounter = DatabaseManager.encounter(encounterId);

    if (!encounter) {
      console.error(`Cannot start unknown encounter ${encounterId}.`);
      return false;
    }

    const battleContext = this.battleContextForCurrentScene();
    this.push(Scene_Battle, encounter, onComplete, battleContext);
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
    this.syncAudioForCurrentScene();

    DebugManager.log(`Returned to scene: ${this.currentScene.constructor.name}`);
  }
}
