"use strict";

class Graphics {
  static initialize() {
    this.canvas = document.getElementById("gameCanvas");

    this.context = this.canvas.getContext("2d");

    this.width = 1280;
    this.height = 720;

    this.canvas.width = this.width;

    this.canvas.height = this.height;

    console.log("Graphics initialized.");
  }

  static clear() {
    this.context.fillStyle = "#202020";

    this.context.fillRect(0, 0, this.width, this.height);
  }
}
