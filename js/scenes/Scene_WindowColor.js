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

    context.fillStyle = "#f2f4f6";
    context.font = "34px Arial";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("WINDOW COLOR", 70, 62);

    context.font = "15px Arial";
    context.fillStyle = "#b4bec8";
    context.fillText(this.windowColorWindow.hintText(), 70, 98);
    context.restore();

    this.windowColorWindow.draw();
  }
}
