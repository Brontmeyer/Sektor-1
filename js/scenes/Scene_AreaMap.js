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
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    const gradient = context.createLinearGradient(0, 0, Graphics.width, 0);
    gradient.addColorStop(0, "rgba(46, 52, 62, 0.2)");
    gradient.addColorStop(0.5, "rgba(11, 14, 19, 0)");
    gradient.addColorStop(1, "rgba(35, 39, 48, 0.14)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, Graphics.width, Graphics.height);
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
