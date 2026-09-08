"use strict";

class Scene_Menu extends Scene_Base {
  constructor() {
    super();

    this.commandWindow = new Window_MenuCommand();

    this.inventoryWindow = new Window_Inventory();
    this.statusWindow = new Window_Status();
    this.equipmentWindow = new Window_Equipment();
    this.saveSlotsWindow = new Window_SaveSlots();

    this.saveMessage = "";
    this.saveMessageTimer = 0;
  }

  update(deltaTime) {
    // SAVE MESSAGE TIMER

    if (this.saveMessageTimer > 0) {
      this.saveMessageTimer--;

      if (this.saveMessageTimer <= 0) {
        this.saveMessage = "";
      }
    }

    // ===============================
    // SAVE / LOAD SLOTS OPEN
    // ===============================

    if (this.saveSlotsWindow.hasResult()) {
      const slotId = this.saveSlotsWindow.takeResult();

      const mode = this.saveSlotsWindow.mode;

      if (mode === "save") {
        const success = SaveManager.save(slotId);

        if (success) {
          this.saveMessage = `Game saved to Slot ${slotId}!`;

          this.saveMessageTimer = 180;
        }
      } else if (mode === "load") {
        if (!SaveManager.exists(slotId)) {
          this.saveMessage = `Slot ${slotId} is empty.`;

          this.saveMessageTimer = 180;
        } else {
          SaveManager.load(slotId).then((success) => {
            if (success) {
              SceneManager.pop();

              console.log(`Loaded from slot ${slotId}.`);
            }
          });
        }
      }

      return;
    }

    if (this.saveSlotsWindow.isOpen()) {
      this.saveSlotsWindow.update();

      return;
    }

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

        case "Save Slots":
          this.saveSlotsWindow.show();

          break;

        case "Save":
          this.saveSlotsWindow.show("save");

          break;

        case "Load":
          this.saveSlotsWindow.show("load");

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

    // =====================================
    // DRAW ACTIVE WINDOW
    // =====================================

    if (this.saveSlotsWindow.isOpen()) {
      this.saveSlotsWindow.draw();
    } else if (this.inventoryWindow.isOpen()) {
      this.inventoryWindow.draw();
    } else if (this.statusWindow.isOpen()) {
      this.statusWindow.draw();
    } else if (this.equipmentWindow.isOpen()) {
      this.equipmentWindow.draw();
    } else {
      this.commandWindow.draw();
    }

    // ===============================
    // SAVE CONFIRMATION WINDOW
    // ===============================

    if (this.saveMessage) {
      const boxWidth = 340;
      const boxHeight = 100;

      const boxX = (Graphics.width - boxWidth) / 2;
      const boxY = Graphics.height - boxHeight - 325;

      context.save();

      // Window background
      context.fillStyle = "#000000";
      context.fillRect(boxX, boxY, boxWidth, boxHeight);

      // Window border
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2;
      context.strokeRect(boxX, boxY, boxWidth, boxHeight);

      // Message
      context.fillStyle = "#ffffff";
      context.font = "22px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";

      context.fillText(
        this.saveMessage,
        Graphics.width / 2,
        boxY + boxHeight / 2,
      );

      context.restore();
    }
  }
}
