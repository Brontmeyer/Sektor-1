"use strict";

class Scene_AreaMap extends Scene_Base {
  constructor(snapshot = null) {
    super();
    this.snapshot = snapshot;
    this.areaMapWindow = null;
  }

  start() {
    super.start();
    this.areaMapWindow = new Window_AreaMap(this.snapshot);
  }

  update() {
    if (
      Input.isActionTriggered("cancel") ||
      Input.isActionTriggered("menu")
    ) {
      SceneManager.pop();
      return;
    }

    this.areaMapWindow?.update?.();
  }

  drawBackground(context) {
    MenuScreenLayout.drawBackdrop(context);
  }

  draw() {
    const context = Graphics.context;
    context.save();
    this.drawBackground(context);
    this.areaMapWindow?.draw?.();
    context.restore();
  }

  terminate() {
    this.areaMapWindow = null;
    super.terminate();
  }
}
