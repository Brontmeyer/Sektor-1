"use strict";

class Scene_Options extends Scene_Base {
  constructor() {
    super();
    this.optionsWindow = new Window_Options({
      onControls: () => SceneManager.push(Scene_Controls),
      onWindowColor: () => SceneManager.push(Scene_WindowColor),
    });
  }

  update() {
    if (Input.isActionTriggered("cancel")) {
      SceneManager.pop();
      return;
    }

    this.optionsWindow.update();
  }

  draw() {
    const context = Graphics.context;

    context.save();
    MenuScreenLayout.drawBackdrop(context);
    context.restore();

    this.optionsWindow.draw();
  }
}
