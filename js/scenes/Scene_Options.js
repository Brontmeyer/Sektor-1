"use strict";

class Scene_Options extends Scene_Base {
  constructor() {
    super();
    this.optionsWindow = new Window_Options({
      onControls: () => SceneManager.push(Scene_Controls),
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
    context.fillStyle = "#20252b";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    const gradient = context.createLinearGradient(0, 0, Graphics.width, 0);
    gradient.addColorStop(0, "rgba(150, 171, 187, 0.13)");
    gradient.addColorStop(0.5, "rgba(32, 37, 43, 0)");
    gradient.addColorStop(1, "rgba(118, 139, 154, 0.1)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    context.fillStyle = "#f2f4f6";
    context.font = "34px Arial";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("OPTION", 70, 62);

    context.font = "15px Arial";
    context.fillStyle = "#b4bec8";
    context.fillText(
      `${Input.actionLabel("left")} / ${Input.actionLabel("right")}: Change    ` +
        `${Input.actionLabel("confirm")}: Next / Open    ` +
        `${Input.actionLabel("cancel")}: Back`,
      70,
      104,
    );
    context.restore();

    this.optionsWindow.draw();
  }
}
