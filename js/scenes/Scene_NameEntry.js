"use strict";

class Scene_NameEntry extends Scene_Base {
  constructor(actorOrId = 1, options = {}) {
    super();
    this.actorOrId = actorOrId;
    this.options = options || {};
    this.nameWindow = null;
    this.completed = false;
  }

  resolveActor() {
    if (this.actorOrId instanceof Game_Actor) {
      return this.actorOrId;
    }

    const actorId = Number(this.actorOrId);
    return globalThis.$gameSystem?.actor?.(actorId) || null;
  }

  start() {
    super.start();
    const actor = this.resolveActor();

    if (!actor) {
      throw new Error(`Cannot open name entry for unknown actor ${this.actorOrId}.`);
    }

    this.nameWindow = new Window_NameEntry(actor, this.options);
  }

  update() {
    if (!this.nameWindow || this.completed) {
      return;
    }

    this.nameWindow.update();

    if (!this.nameWindow.isComplete()) {
      return;
    }

    this.completed = true;
    const actor = this.nameWindow.actor;

    if (typeof this.options.onComplete === "function") {
      this.options.onComplete(actor);
      return;
    }

    if (Array.isArray(SceneManager.sceneStack) && SceneManager.sceneStack.length > 0) {
      SceneManager.pop();
      return;
    }

    SceneManager.goto(Scene_Map);
  }

  draw() {
    this.nameWindow?.draw?.();
  }

  terminate() {
    this.nameWindow = null;
    super.terminate();
  }
}
