"use strict";

class Scene_Menu extends Scene_Base {
  constructor() {
    super();

    this.commandWindow = new Window_MenuCommand();

    this.inventoryWindow = new Window_Inventory();

    this.statusWindow = new Window_Status();

    this.equipmentWindow = new Window_Equipment();
  }

  update(deltaTime) {
    // =====================================
    // INVENTORY OPEN
    // =====================================

    if (this.inventoryWindow.isOpen()) {
      this.inventoryWindow.update();

      return;
    }

    // =====================================
    // STATUS OPEN
    // =====================================

    if (this.statusWindow.isOpen()) {
      this.statusWindow.update();

      return;
    }

    // =====================================
    // EQUIPMENT OPEN
    // =====================================

    if (this.equipmentWindow.isOpen()) {
      this.equipmentWindow.update();

      return;
    }

    // =====================================
    // CLOSE MAIN MENU
    // =====================================

    if (Input.isTriggered("Escape")) {
      SceneManager.pop();

      return;
    }

    // =====================================
    // UPDATE MENU COMMANDS
    // =====================================

    this.commandWindow.update();

    // =====================================
    // SELECT MENU COMMAND
    // =====================================

    if (Input.isTriggered("KeyE") || Input.isTriggered("Enter")) {
      const command = this.commandWindow.currentCommand();

      switch (command) {
        case "Items":
          this.inventoryWindow.show();

          break;

        case "Status":
          this.statusWindow.show();

          break;

        case "Equipment":
          this.equipmentWindow.show();

          break;

        default:
          console.log(`${command} is not implemented yet.`);

          break;
      }
    }
  }

  draw() {
    const context = Graphics.context;

    context.save();

    // Menu background

    context.fillStyle = "#202020";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    // Game title

    context.fillStyle = "#ffffff";
    context.font = "32px sans-serif";
    context.textAlign = "left";
    
    context.fillText(DatabaseManager.system.gameTitle || "Sektor 1", 60, 60);

    context.restore();

    if (this.inventoryWindow.isOpen()) {
      this.inventoryWindow.draw();
    } else if (this.statusWindow.isOpen()) {
      this.statusWindow.draw();
    } else if (this.equipmentWindow.isOpen()) {
      this.equipmentWindow.draw();
    } else {
      this.commandWindow.draw();
    }
  }
}
