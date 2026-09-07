"use strict";

class Scene_Map extends Scene_Base {
  constructor() {
    super();

    this.map = null;
    this.player = null;
    this.camera = null;

    this.loading = true;
    this.transferring = false;

    this.messageWindow = new Window_Message();
    this.choiceWindow = new Window_Choice();

    this.interpreter = new Game_Interpreter(
      this.messageWindow,
      this.choiceWindow,
    );
  }

  start() {
    super.start();

    this.loadMap();
  }

  async loadMap() {
    const mapId = DatabaseManager.system.startMapId;

    const mapData = await DatabaseManager.loadMap(mapId);

    this.map = new Game_Map(mapData);

    this.player = new Game_Player(this.map);

    this.camera = new Camera(this.map);

    this.loading = false;

    console.log("Map scene ready.");
  }

  update(deltaTime) {
    if (this.loading || this.transferring) {
      return;
    }

    // =====================================
    // MAIN MENU
    // =====================================

    if (
      Input.isTriggered("Escape") &&
      !this.messageWindow.isOpen() &&
      !this.choiceWindow.isOpen() &&
      !this.interpreter.isRunning()
    ) {
      SceneManager.push(Scene_Menu);

      return;
    }

    const wasBusy =
      this.messageWindow.isOpen() ||
      this.choiceWindow.isOpen() ||
      this.interpreter.isRunning();

    if (!this.choiceWindow.isOpen()) {
      this.messageWindow.update();
    }

    this.choiceWindow.update();

    this.interpreter.update();

    for (const event of this.map.events) {
      event.update(deltaTime);
    }

    const isBusy =
      this.messageWindow.isOpen() ||
      this.choiceWindow.isOpen() ||
      this.interpreter.isRunning();

    if (!wasBusy && !isBusy) {
      this.player.update(deltaTime);

      this.checkEventInteraction();

      this.checkTransfers();
    } else if (!isBusy) {
      // Dialogue/event just finished this frame.
      // Allow movement again next frame,
      // but don't reuse the same E/Enter press.

      this.player.update(deltaTime);
    }

    this.camera.follow(this.player);
  }

  checkEventInteraction() {
    if (!Input.isTriggered("KeyE")) {
      return;
    }

    const interactionDistance = 60;

    for (const event of this.map.events) {
      const playerCenterX = this.player.x + this.player.width / 2;

      const playerCenterY = this.player.y + this.player.height / 2;

      const eventCenterX = event.x + event.width / 2;

      const eventCenterY = event.y + event.height / 2;

      const dx = eventCenterX - playerCenterX;

      const dy = eventCenterY - playerCenterY;

      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= interactionDistance) {
        this.activateEvent(event);

        return;
      }
    }
  }

  activateEvent(event) {
    if (this.interpreter.isRunning()) {
      return;
    }

    console.log(`Activated event: ${event.name}`);

    this.interpreter.setup(event.commands, event);
  }

  checkTransfers() {
    for (const transfer of this.map.transfers) {
      const touching = CollisionManager.intersects(
        this.player.x,
        this.player.y,
        this.player.width,
        this.player.height,
        transfer,
      );

      if (touching) {
        this.performTransfer(transfer);

        return;
      }
    }
  }

  async performTransfer(transfer) {
    this.transferring = true;

    console.log(`Transferring to map ${transfer.targetMapId}...`);

    const mapData = await DatabaseManager.loadMap(transfer.targetMapId);

    this.map = new Game_Map(mapData);

    this.player = new Game_Player(this.map);

    this.player.x = transfer.targetX;

    this.player.y = transfer.targetY;

    this.camera = new Camera(this.map);

    this.camera.follow(this.player);

    this.transferring = false;

    console.log(`Transfer complete: ${this.map.name}`);
  }

  draw() {
    if (this.loading) {
      this.drawLoadingScreen();

      return;
    }

    this.map.draw(this.camera.x, this.camera.y);

    this.player.draw(this.camera.x, this.camera.y);

    this.messageWindow.draw();

    this.choiceWindow.draw();
  }

  drawLoadingScreen() {
    Graphics.context.fillStyle = "white";

    Graphics.context.font = "28px Arial";

    Graphics.context.textAlign = "center";

    Graphics.context.fillText(
      "Loading...",
      Graphics.width / 2,
      Graphics.height / 2,
    );
  }

  terminate() {
    super.terminate();

    console.log("Map scene terminated.");
  }
}
