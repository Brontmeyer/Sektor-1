"use strict";

class Scene_WindowColor extends Scene_Base {
  constructor() {
    super();
    this.windowColorWindow = new Window_WindowColor({
      onBack: () => SceneManager.pop(),
    });
  }

  update() {
    this.windowColorWindow.update();
  }

  draw() {
    const context = Graphics.context;

    context.save();
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    context.restore();

    this.windowColorWindow.draw();
  }
}
