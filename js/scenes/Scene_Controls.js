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
    context.fillText("CONTROLS", 70, 62);

    context.font = "15px Arial";
    context.fillStyle = "#9fb0c1";
    context.fillText(
      `${Input.actionLabel("up")} / ${Input.actionLabel("down")}: Choose    ` +
        `${Input.actionLabel("left")} / ${Input.actionLabel("right")}: Slot    ` +
        `${Input.actionLabel("confirm")}: Rebind    ${Input.actionLabel("cancel")}: Back`,
      70,
      104,
    );
    context.restore();

    this.controlsWindow.draw();
  }
}
