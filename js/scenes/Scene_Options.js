"use strict";

class Scene_Options extends Scene_Base {
  constructor() {
    super();
    this.optionsWindow = new Window_Options();
  }

  update() {
    if (Input.isTriggered("Escape") || Input.isTriggered("KeyQ")) {
      SceneManager.pop();
      return;
    }

    this.optionsWindow.update();
  }

  draw() {
    const context = Graphics.context;

    context.save();
    context.fillStyle = "#111820";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    const gradient = context.createLinearGradient(0, 0, Graphics.width, 0);
    gradient.addColorStop(0, "rgba(90, 150, 195, 0.18)");
    gradient.addColorStop(0.5, "rgba(18, 26, 34, 0)");
    gradient.addColorStop(1, "rgba(90, 150, 195, 0.12)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    context.fillStyle = "#ffffff";
    context.font = "34px Arial";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("OPTIONS", 70, 62);

    context.font = "15px Arial";
    context.fillStyle = "#9fb0c1";
    context.fillText(
      "A / D or ← / →: Change    E / Enter: Next    Q / Esc: Back",
      70,
      104,
    );
    context.restore();

    this.optionsWindow.draw();
  }
}
