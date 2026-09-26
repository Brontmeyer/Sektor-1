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
    MenuScreenLayout.drawBackdrop(context);
    context.restore();

    this.windowColorWindow.draw();
  }
}
