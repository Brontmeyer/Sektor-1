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
    MenuScreenLayout.drawBackdrop(context);
    context.restore();

    this.controlsWindow.draw();
  }
}
