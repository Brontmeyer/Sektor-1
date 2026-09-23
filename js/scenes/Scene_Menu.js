"use strict";

class Scene_Menu extends Scene_Base {
  constructor(locationName = "", menuContext = {}) {
    super();

    this.layout = MainMenuLayout.calculate(Graphics.width, Graphics.height);
    this.locationName = locationName || "Unknown Location";
    this.menuAccess = new MenuAccessPolicy(menuContext);

    this.commandWindow = new Window_MenuCommand(
      this.layout.commands,
      this.menuAccess,
    );
    this.partyWindow = new Window_MainMenuParty($gameParty, this.layout.party);

    this.inventoryWindow = new Window_Inventory($gameParty);
    this.statusWindow = new Window_Status($gameParty);
    this.valorWindow = new Window_Valor($gameParty);
    this.equipmentWindow = new Window_Equipment($gameParty);
    this.saveSlotsWindow = new Window_SaveSlots();

    this.magickWindow = new Window_Magick($gameParty);
    this.skillsWindow = new Window_Skills($gameParty);
    this.essenceWindow = new Window_Essence($gameParty);

    this.pendingActorCommand = null;
    this.saveMessage = "";
    this.saveMessageTimer = 0;
  }

  actorDestinationWindow(command) {
    return {
      Magick: this.magickWindow,
      Skill: this.skillsWindow,
      Essence: this.essenceWindow,
      Equip: this.equipmentWindow,
      Status: this.statusWindow,
      Valor: this.valorWindow,
    }[command] || null;
  }

  selectActorInWindow(window, actor) {
    if (!window || !actor) {
      return false;
    }

    if (window.actorNavigation?.selectActor) {
      window.actorNavigation.selectActor(actor);
    }

    if (typeof window.onActorChanged === "function") {
      window.onActorChanged();
    }

    window.show?.();
    return true;
  }

  beginActorSelection(command) {
    if (!this.partyWindow.activate("actor")) {
      this.saveMessage = "No active party member is available.";
      this.saveMessageTimer = 2;
      return false;
    }

    this.pendingActorCommand = command;
    return true;
  }

  beginOrderSelection() {
    if (!this.partyWindow.activate("order")) {
      this.saveMessage = "No active party member is available.";
      this.saveMessageTimer = 2;
      return false;
    }

    this.pendingActorCommand = "Order";
    return true;
  }

  endPartySelection() {
    this.partyWindow.deactivate();
    this.pendingActorCommand = null;
  }

  openActorDestination(command, actor) {
    if (!actor) {
      return false;
    }

    const window = this.actorDestinationWindow(command);

    if (!window) {
      return false;
    }

    const opened = this.selectActorInWindow(window, actor);

    if (opened) {
      this.endPartySelection();
    }

    return opened;
  }

  updatePartySelection() {
    const result = this.partyWindow.update();

    if (!result) {
      return;
    }

    if (result.type === "cancel") {
      this.endPartySelection();
      return;
    }

    if (this.partyWindow.mode === "order") {
      // Row edits and slot swaps are committed immediately to Game_Party.
      // Formation ordering is visual only: active-party membership, turn
      // scheduling, stats, damage, targeting rules, and action priority stay
      // independent from where a battler is drawn.
      return;
    }

    if (result.type === "confirm") {
      this.openActorDestination(this.pendingActorCommand, result.actor);
    }
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

    if (this.valorWindow.isOpen()) {
      this.valorWindow.update();
      return;
    }

    if (this.equipmentWindow.isOpen()) {
      this.equipmentWindow.update();
      return;
    }

    if (this.partyWindow.isActive()) {
      this.updatePartySelection();
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
    const commandState = this.commandWindow.currentCommandState();

    if (commandState.enabled === false) {
      this.saveMessage = commandState.reason || `${command} is unavailable.`;
      this.saveMessageTimer = 2;
      return;
    }

    switch (command) {
      case "Item":
        this.inventoryWindow.show();
        break;

      case "Magick":
      case "Skill":
      case "Essence":
      case "Equip":
      case "Status":
      case "Valor":
        this.beginActorSelection(command);
        break;

      case "Order":
        this.beginOrderSelection();
        break;

      case "Config":
        SceneManager.push(Scene_Options);
        break;

      case "Save":
        this.saveSlotsWindow.show("save");
        break;

      case "Load":
        this.saveSlotsWindow.show("load");
        break;

      case "Exit":
        SceneManager.pop();
        break;

      case "ROSTER":
        this.saveMessage = "ROSTER is planned for a focused pass.";
        this.saveMessageTimer = 2;
        DebugManager.log("ROSTER is planned but not implemented yet.");
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
      this.valorWindow.isOpen() ||
      this.equipmentWindow.isOpen()
    );
  }

  drawBackground(context) {
    context.fillStyle = "#0b0e13";
    context.fillRect(0, 0, Graphics.width, Graphics.height);

    const gradient = context.createLinearGradient(0, 0, Graphics.width, 0);
    gradient.addColorStop(0, "rgba(46, 52, 62, 0.2)");
    gradient.addColorStop(0.5, "rgba(11, 14, 19, 0)");
    gradient.addColorStop(1, "rgba(35, 39, 48, 0.14)");
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
          fallbackFill: "rgba(12, 20, 48, 0.94)",
          fallbackStroke: "rgba(145, 162, 238, 0.74)",
          innerStroke: "rgba(232, 234, 255, 0.16)",
          assetAlpha: 0.5,
          lineWidth: 1.5,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
    }

    context.fillStyle = options.fallbackFill || "rgba(12, 20, 48, 0.94)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle =
      options.fallbackStroke || "rgba(145, 162, 238, 0.74)";
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  partySelectionHint() {
    if (!this.partyWindow.isActive()) {
      return "";
    }

    if (this.partyWindow.mode === "order") {
      const swapping = this.partyWindow.hasPendingSwap?.() === true;
      const confirmLabel = swapping ? "Swap" : "Pick Up";
      const cancelLabel = swapping ? "Cancel" : "Back";

      return `${Input.actionLabel("up")}/${Input.actionLabel("down")}: ${swapping ? "Destination" : "Actor"}   ` +
        `${Input.actionLabel("left")}: Back   ${Input.actionLabel("right")}: Front   ` +
        `${Input.actionLabel("confirm")}: ${confirmLabel}   ${Input.actionLabel("cancel")}: ${cancelLabel}`;
    }

    return `${this.pendingActorCommand}: choose actor   ` +
      `${Input.actionLabel("confirm")}: Select   ${Input.actionLabel("cancel")}: Back`;
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

    const hint = this.partySelectionHint();

    if (hint) {
      context.font = "13px sans-serif";
      context.textAlign = "right";
      context.fillStyle = "#bdc9d8";
      context.fillText(
        hint,
        this.layout.header.x + this.layout.header.width - 18,
        this.layout.header.y + this.layout.header.height / 2,
      );
    }
  }

  formattedPlayTime() {
    return globalThis.$gameSystem?.formattedPlayTime?.() || "00:00:00";
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
    context.fillText("RUNES", utilityX, this.layout.utility.y + 23);
    context.fillText("TIME", utilityX, this.layout.utility.y + 49);

    context.textAlign = "right";
    context.fillStyle = "#ffffff";
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
    } else if (this.valorWindow.isOpen()) {
      this.valorWindow.draw();
    } else if (this.equipmentWindow.isOpen()) {
      this.equipmentWindow.draw();
    }
  }

  drawSaveMessage(context) {
    if (!this.saveMessage) {
      return;
    }

    const boxWidth = 420;
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
