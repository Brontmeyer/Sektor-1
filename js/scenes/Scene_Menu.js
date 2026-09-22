"use strict";

class Scene_Menu extends Scene_Base {
  constructor(locationName = "") {
    super();

    this.layout = MainMenuLayout.calculate(Graphics.width, Graphics.height);
    this.locationName = locationName || "Unknown Location";

    this.commandWindow = new Window_MenuCommand(this.layout.commands);
    this.partyWindow = new Window_MainMenuParty($gameParty, this.layout.party);

    const actor = $gameParty.leader();

    this.inventoryWindow = new Window_Inventory(actor);
    this.statusWindow = new Window_Status($gameParty);
    this.equipmentWindow = new Window_Equipment($gameParty);
    this.saveSlotsWindow = new Window_SaveSlots();

    this.magickWindow = new Window_Magick($gameParty);
    this.skillsWindow = new Window_Skills($gameParty);
    this.essenceWindow = new Window_Essence($gameParty);

    this.saveMessage = "";
    this.saveMessageTimer = 0;
  }

  update(deltaTime) {
    if (this.saveMessageTimer > 0) {
      this.saveMessageTimer -= deltaTime;

      if (this.saveMessageTimer <= 0) {
        this.saveMessage = "";
      }
    }

    if (this.saveSlotsWindow.hasResult()) {
      const slotId = this.saveSlotsWindow.takeResult();
      const mode = this.saveSlotsWindow.mode;

      if (mode === "save") {
        const success = SaveManager.save(slotId);

        if (success) {
          this.saveMessage = `Game saved to Slot ${slotId}!`;
        } else {
          this.saveMessage = `Save failed: ${SaveManager.errorMessage()}`;
        }

        this.saveMessageTimer = 3;
      } else if (mode === "load") {
        if (!SaveManager.exists(slotId)) {
          this.saveMessage = `Slot ${slotId} is empty.`;
          this.saveMessageTimer = 3;
        } else {
          SaveManager.load(slotId)
            .then((success) => {
              if (success) {
                SceneManager.pop();
                DebugManager.log(`Loaded from slot ${slotId}.`);
                return;
              }

              this.saveMessage = `Load failed: ${SaveManager.errorMessage()}`;
              this.saveMessageTimer = 3;
            })
            .catch((error) => {
              console.error(`Unexpected load failure for slot ${slotId}:`, error);
              this.saveMessage = `Load failed: ${SaveManager.errorMessage()}`;
              this.saveMessageTimer = 3;
            });
        }
      }

      return;
    }

    if (this.saveSlotsWindow.isOpen()) {
      this.saveSlotsWindow.update();
      return;
    }

    if (this.inventoryWindow.isOpen()) {
      this.inventoryWindow.update();
      return;
    }

    if (this.magickWindow.isOpen()) {
      this.magickWindow.update();
      return;
    }

    if (this.skillsWindow.isOpen()) {
      this.skillsWindow.update();
      return;
    }

    if (this.essenceWindow.isOpen()) {
      this.essenceWindow.update();
      return;
    }

    if (this.statusWindow.isOpen()) {
      this.statusWindow.update();
      return;
    }

    if (this.equipmentWindow.isOpen()) {
      this.equipmentWindow.update();
      return;
    }

    if (Input.isActionTriggered("menu")) {
      SceneManager.pop();
      return;
    }

    this.commandWindow.update();

    if (!Input.isActionTriggered("confirm")) {
      return;
    }

    const command = this.commandWindow.currentCommand();

    switch (command) {
      case "Item":
        this.inventoryWindow.show();
        break;

      case "Magick":
        this.magickWindow.show();
        break;

      case "Skill":
        this.skillsWindow.show();
        break;

      case "Essence":
        this.essenceWindow.show();
        break;

      case "Equip":
        this.equipmentWindow.show();
        break;

      case "Status":
        this.statusWindow.show();
        break;

      case "Option":
        SceneManager.push(Scene_Options);
        break;

      case "Save":
        this.saveSlotsWindow.show("save");
        break;

      case "Exit":
        SceneManager.pop();
        break;

      case "Order":
      case "Valor":
      case "ROSTER":
        this.saveMessage = `${command} is planned for a focused pass.`;
        this.saveMessageTimer = 2;
        DebugManager.log(`${command} is planned but not implemented yet.`);
        break;

      default:
        DebugManager.log(`${command} is not implemented yet.`);
        break;
    }
  }

  hasSubWindowOpen() {
    return (
      this.saveSlotsWindow.isOpen() ||
      this.inventoryWindow.isOpen() ||
      this.magickWindow.isOpen() ||
      this.skillsWindow.isOpen() ||
      this.essenceWindow.isOpen() ||
      this.statusWindow.isOpen() ||
      this.equipmentWindow.isOpen()
    );
  }

  drawBackground(context) {
    context.fillStyle = "#171d27";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    const gradient = context.createLinearGradient(0, 0, Graphics.width, 0);
    gradient.addColorStop(0, "rgba(74, 110, 166, 0.2)");
    gradient.addColorStop(0.5, "rgba(23, 29, 39, 0)");
    gradient.addColorStop(1, "rgba(43, 76, 130, 0.14)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, Graphics.width, Graphics.height);
  }

  drawPanel(context, bounds, options = {}) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      return UIAssetManager.drawPanel(
        context,
        "menuPanel",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(14, 19, 29, 0.94)",
          fallbackStroke: "rgba(139, 174, 225, 0.72)",
          innerStroke: "rgba(228, 238, 249, 0.15)",
          assetAlpha: 0.5,
          lineWidth: 1.5,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
    }

    context.fillStyle = options.fallbackFill || "rgba(14, 19, 29, 0.94)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle =
      options.fallbackStroke || "rgba(139, 174, 225, 0.72)";
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  drawMainHeader(context) {
    this.drawPanel(context, this.layout.header, { assetAlpha: 0.48 });
    context.fillStyle = "#f4f7fb";
    context.font = "600 20px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
      "MAIN MENU",
      this.layout.header.x + 20,
      this.layout.header.y + this.layout.header.height / 2,
    );
  }

  formattedPlayTime() {
    // A persistent play-time runtime does not exist yet. Do not fabricate one
    // from wall-clock/session time and silently present it as save playtime.
    return "--:--:--";
  }

  drawUtilityPanels(context) {
    this.drawPanel(context, this.layout.utility, { assetAlpha: 0.46 });
    this.drawPanel(context, this.layout.location, { assetAlpha: 0.46 });

    const utilityX = this.layout.utility.x + 16;
    const valueX = this.layout.utility.x + this.layout.utility.width - 16;

    context.font = "600 15px sans-serif";
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = "#cbd8e7";
    context.fillText("GIL", utilityX, this.layout.utility.y + 23);
    context.fillText("TIME", utilityX, this.layout.utility.y + 49);

    context.textAlign = "right";
    context.fillStyle = "#ffd75a";
    context.fillText(
      Number($gameParty.gil?.() || 0).toLocaleString(),
      valueX,
      this.layout.utility.y + 23,
    );
    context.fillStyle = "#6fd8ff";
    context.fillText(this.formattedPlayTime(), valueX, this.layout.utility.y + 49);

    context.textAlign = "left";
    context.fillStyle = "#aebfd1";
    context.font = "13px sans-serif";
    context.fillText(
      "LOCATION",
      this.layout.location.x + 16,
      this.layout.location.y + 18,
    );
    context.fillStyle = "#f1f5fa";
    context.font = "15px sans-serif";
    context.fillText(
      this.locationName,
      this.layout.location.x + 16,
      this.layout.location.y + 42,
    );
  }

  drawMainMenu(context) {
    this.drawMainHeader(context);
    this.partyWindow.draw();
    this.commandWindow.draw();
    this.drawUtilityPanels(context);
  }

  drawActiveWindow() {
    if (this.saveSlotsWindow.isOpen()) {
      this.saveSlotsWindow.draw();
    } else if (this.inventoryWindow.isOpen()) {
      this.inventoryWindow.draw();
    } else if (this.magickWindow.isOpen()) {
      this.magickWindow.draw();
    } else if (this.skillsWindow.isOpen()) {
      this.skillsWindow.draw();
    } else if (this.essenceWindow.isOpen()) {
      this.essenceWindow.draw();
    } else if (this.statusWindow.isOpen()) {
      this.statusWindow.draw();
    } else if (this.equipmentWindow.isOpen()) {
      this.equipmentWindow.draw();
    }
  }

  drawSaveMessage(context) {
    if (!this.saveMessage) {
      return;
    }

    const boxWidth = 340;
    const boxHeight = 92;
    const boxX = (Graphics.width - boxWidth) / 2;
    const boxY = Graphics.height - boxHeight - 70;
    const bounds = { x: boxX, y: boxY, width: boxWidth, height: boxHeight };

    context.save();
    this.drawPanel(context, bounds, {
      assetAlpha: 0.62,
      fallbackStroke: "rgba(240, 243, 248, 0.8)",
    });
    context.fillStyle = "#ffffff";
    context.font = "20px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      this.saveMessage,
      Graphics.width / 2,
      boxY + boxHeight / 2,
    );
    context.restore();
  }

  draw() {
    const context = Graphics.context;

    context.save();
    this.drawBackground(context);

    if (this.hasSubWindowOpen()) {
      this.drawActiveWindow();
    } else {
      this.drawMainMenu(context);
    }

    this.drawSaveMessage(context);
    context.restore();
  }
}
