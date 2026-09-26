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
    this.camera.follow(this.player);
    this.map.updateAreaDiscovery?.(this.player);

    this.loading = false;

    DebugManager.log("Map scene ready.");
  }

  quickMapRoute() {
    if (!this.map?.areaMapEnabled?.()) {
      return null;
    }

    const snapshot = this.map.areaMapSnapshot?.(this.player) || null;

    if (!snapshot) {
      return null;
    }

    return {
      scope: "area",
      sceneClass: Scene_AreaMap,
      args: [snapshot],
    };
  }

  openQuickMap() {
    const route = this.quickMapRoute();

    if (!route?.sceneClass) {
      return false;
    }

    SceneManager.push(route.sceneClass, ...(route.args || []));
    return true;
  }

  fieldInputAvailable() {
    return (
      !this.messageWindow.isOpen() &&
      !this.choiceWindow.isOpen() &&
      !this.interpreter.isRunning()
    );
  }

  update(deltaTime) {
    if (this.loading || this.transferring) {
      return;
    }

    // =====================================
    // QUICK MAP / MAIN MENU
    // =====================================

    if (
      Input.isActionTriggered("map") &&
      this.fieldInputAvailable() &&
      this.openQuickMap()
    ) {
      return;
    }

    if (
      Input.isActionTriggered("menu") &&
      this.fieldInputAvailable()
    ) {
      SceneManager.push(
        Scene_Menu,
        this.map?.name || "Unknown Location",
        {
          debugMode: DatabaseManager.system?.debugMode === true,
          mapAccess: this.map?.menuAccess || {},
          areaMap: this.map?.areaMapSnapshot?.(this.player) || null,
          commandStates: {
            Map: {
              visible: true,
              enabled: this.map?.areaMapEnabled?.() === true,
              reason: "An area map is not available here.",
            },
            ROSTER: {
              visible: ($gameParty?.members?.() || []).length > 1,
              enabled: true,
              reason: "",
            },
          },
        },
      );

      return;
    }

    const wasBusy =
      this.messageWindow.isOpen() ||
      this.choiceWindow.isOpen() ||
      this.interpreter.isRunning();

    this.messageWindow.update(deltaTime, {
      allowInput: !this.choiceWindow.isOpen(),
    });

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

      this.map.updateAreaDiscovery?.(this.player);
      this.checkTransfers();
    } else if (!isBusy) {
      // Dialogue/event just finished this frame.
      // Allow movement again next frame,
      // but don't reuse the same confirm/interact press.

      this.player.update(deltaTime);
      this.map.updateAreaDiscovery?.(this.player);
    }
    this.camera.follow(this.player);
  }

  checkEventInteraction() {
    if (!Input.isActionTriggered("interact")) {
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

    this.interpreter.setup(event.commands, event);

    DebugManager.log(`Activated event: ${event.name}`);
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

    DebugManager.log(`Transferring to map ${transfer.targetMapId}...`);

    try {
      const mapData = await DatabaseManager.loadMap(transfer.targetMapId);

      this.map = new Game_Map(mapData);

      this.player = new Game_Player(this.map);

      this.player.x = transfer.targetX;

      this.player.y = transfer.targetY;

      this.player.velocityX = 0;
      this.player.velocityY = 0;

      this.camera = new Camera(this.map);

      this.camera.follow(this.player);
      this.map.updateAreaDiscovery?.(this.player);

      DebugManager.log(`Transfer complete: ${this.map.name}`);
    } catch (error) {
      console.error("Map transfer failed:", error);
    } finally {
      this.transferring = false;
    }
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

    DebugManager.log("Map scene terminated.");
  }
}
