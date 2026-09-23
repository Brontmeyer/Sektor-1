"use strict";

class Scene_Controls extends Scene_Base {
  constructor() {
    super();
    this.controlsWindow = new Window_Controls({
      onBack: () => SceneManager.pop(),
    });
  }

  update() {
    this.controlsWindow.update();
  }

  draw() {
    const context = Graphics.context;

    context.save();
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    context.restore();

    this.controlsWindow.draw();
  }
}
