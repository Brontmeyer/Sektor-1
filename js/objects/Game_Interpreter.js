"use strict";

class Game_Interpreter {
  constructor(messageWindow, choiceWindow) {
    this.messageWindow = messageWindow;
    this.choiceWindow = choiceWindow;

    this.commands = [];

    this.event = null;

    this.index = 0;

    this.running = false;

    this.lastBattleResult = null;
  }

  setup(commands, event = null) {
    this.commands = JSON.parse(JSON.stringify(commands || []));

    this.event = event;

    this.index = 0;

    this.lastBattleResult = null;
    this.running = this.commands.length > 0;
  }

  update() {
    if (!this.running) {
      return;
    }

    const currentCommand = this.commands[this.index];
    const choicePromptReady =
      currentCommand?.code === "choice" &&
      this.messageWindow.isOpen() &&
      typeof this.messageWindow.isMessageFullyRevealed === "function" &&
      this.messageWindow.isMessageFullyRevealed();

    if (
      this.messageWindow.isOpen() &&
      !this.choiceWindow.isOpen() &&
      !this.choiceWindow.hasResult() &&
      !choicePromptReady
    ) {
      return;
    }

    while (this.running && this.index < this.commands.length) {
      const command = this.commands[this.index];

      const shouldContinue = this.executeCommand(command);

      if (!shouldContinue) {
        return;
      }

      this.index++;
    }

    if (this.index >= this.commands.length) {
      this.finish();
    }
  }

  executeCommand(command) {
    switch (command.code) {
      case "text":
        return this.commandText(command);
      case "choice":
        return this.commandChoice(command);

      case "ifSwitch":
        return this.commandIfSwitch(command);
      case "setSwitch":
        return this.commandSetSwitch(command);
      case "setSelfSwitch":
        return this.commandSetSelfSwitch(command);

      case "setVariable":
        return this.commandSetVariable(command);
      case "addVariable":
        return this.commandAddVariable(command);

      case "gainItem":
        return this.commandGainItem(command);
      case "gainItemMessage":
        return this.commandGainItemMessage(command);

      case "gainArmor":
        return this.commandGainArmor(command);
      case "gainArmorMessage":
        return this.commandGainArmorMessage(command);

      case "gainWeapon":
        return this.commandGainWeapon(command);
      case "gainWeaponMessage":
        return this.commandGainWeaponMessage(command);

      case "gainAccessory":
        return this.commandGainAccessory(command);
      case "gainAccessoryMessage":
        return this.commandGainAccessoryMessage(command);

      case "gainExp":
        return this.commandGainExp(command);
      case "gainExpMessage":
        return this.commandGainExpMessage(command);
      case "shop":
        return this.commandShop(command);
      case "battle":
        return this.commandBattle(command);

      default:
        console.warn(`Unknown event command: ${command.code}`);

        return true;
    }
  }

  dialogueIndicatorMode(commandIndex = this.index, speaker = "") {
    const next = this.commands[commandIndex + 1];
    const currentSpeaker = String(speaker || "");
    const nextSpeaker = String(next?.speaker || "");

    if (next?.code === "text" && nextSpeaker === currentSpeaker) {
      return "continue";
    }

    return "end";
  }

  commandText(command) {
    if (this.messageWindow.isOpen()) {
      return;
    }

    this.messageWindow.show(command.text, command.speaker || "", {
      indicatorMode: this.dialogueIndicatorMode(this.index, command.speaker),
    });

    this.index++;

    return false;
  }

  commandChoice(command) {
    // The player has selected something.

    if (this.choiceWindow.hasResult()) {
      const result = this.choiceWindow.getResult();

      const selectedChoice = command.choices[result];

      DebugManager.log(`Choice selected: ${selectedChoice.text}`);

      this.choiceWindow.clearResult();

      // Close the question window now
      // that a choice has been made.

      this.messageWindow.hide();

      const branchCommands = selectedChoice.commands || [];

      /*
       * Replace the current choice command
       * with the commands belonging to the
       * selected branch.
       */

      this.commands.splice(this.index, 1, ...branchCommands);

      /*
       * Do NOT increase this.index here.
       *
       * The first branch command is now
       * sitting at the current index.
       */

      return false;
    }

    // Choice window hasn't opened yet. The prompt owns the screen first so
    // Confirm can reveal its typewriter text without leaking into a choice.
    if (!this.choiceWindow.isOpen()) {
      if (this.messageWindow.isOpen()) {
        const fullyRevealed =
          typeof this.messageWindow.isMessageFullyRevealed === "function"
            ? this.messageWindow.isMessageFullyRevealed()
            : true;

        if (!fullyRevealed) {
          return false;
        }

        const choiceNames = command.choices.map((choice) => choice.text);
        this.choiceWindow.show(choiceNames);
        return false;
      }

      this.messageWindow.show(command.prompt || "", command.speaker || "", {
        indicatorMode: "hidden",
        holdOpenAtEnd: true,
      });
    }

    // Pause interpreter while waiting for the prompt or the player's choice.
    return false;
  }

  commandIfSwitch(command) {
    if (typeof command.value !== "boolean") {
      console.error(`Invalid switch value: ${command.value}`);
      return true;
    }

    const currentValue = $gameSwitches.value(command.id);

    const expectedValue = command.value;

    const branch =
      currentValue === expectedValue
        ? command.trueCommands
        : command.falseCommands;

    const branchCommands = branch || [];

    this.commands.splice(this.index, 1, ...branchCommands);

    return false;
  }

  commandSetSwitch(command) {
    if (typeof command.value !== "boolean") {
      console.error(`Invalid switch value: ${command.value}`);
      return true;
    }

    $gameSwitches.setValue(command.id, command.value);

    return true;
  }

  commandSetSelfSwitch(command) {
    if (!this.event) {
      console.error("setSelfSwitch command requires an active event.");

      return true;
    }

    if (typeof command.value !== "boolean") {
      console.error(`Invalid self-switch value: ${command.value}`);
      return true;
    }

    $gameSelfSwitches.setValue(
      this.event.mapId,
      this.event.id,
      command.letter,
      command.value,
    );

    return true;
  }

  commandSetVariable(command) {
    $gameVariables.setValue(command.id, command.value);

    return true;
  }

  commandAddVariable(command) {
    const amount = Number(command.value);

    if (!Number.isFinite(amount)) {
      console.error(`Invalid variable amount: ${command.value}`);
      return true;
    }

    $gameVariables.addValue(command.id, amount);

    return true;
  }

  // =================================
  // Items, Equipment, and Experience
  // =================================

  commandGainItem(command) {
    const amount = Number(command.amount ?? 1);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid item amount: ${command.amount}`);
      return true;
    }

    $gameParty.gainItem(command.itemId, amount);

    return true;
  }

  commandGainItemMessage(command) {
    if (this.messageWindow.isOpen()) {
      return false;
    }

    const item = DatabaseManager.item(command.itemId);

    if (!item) {
      console.error(`Unknown item ID: ${command.itemId}`);

      return true;
    }

    const amount = Number(command.amount ?? 1);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid item amount: ${command.amount}`);
      return true;
    }

    $gameParty.gainItem(command.itemId, amount);

    const source = command.source || "System";

    let message = "";

    if (amount === 1) {
      const article = item.article || "a";

      if (source === "Chest") {
        message = `You found ${article} ${item.name}!`;
      } else {
        message = `You obtained ${article} ${item.name}!`;
      }
    } else {
      const pluralName = item.pluralName || `${item.name}s`;

      if (source === "Chest") {
        message = `You found ${amount} ${pluralName}!`;
      } else {
        message = `You obtained ${amount} ${pluralName}!`;
      }
    }

    this.messageWindow.show(message, source);

    // Move to the next command,
    // but PAUSE the interpreter here.
    this.index++;

    return false;
  }

  commandGainArmor(command) {
    const amount = Number(command.amount ?? 1);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid armor amount: ${command.amount}`);

      return true;
    }

    $gameParty.gainArmor(command.armorId, amount);

    return true;
  }

  commandGainArmorMessage(command) {
    if (this.messageWindow.isOpen()) {
      return false;
    }

    const armor = DatabaseManager.armor(command.armorId);

    if (!armor) {
      console.error(`Unknown armor ID: ${command.armorId}`);

      return true;
    }

    const amount = Number(command.amount ?? 1);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid armor amount: ${command.amount}`);

      return true;
    }

    $gameParty.gainArmor(command.armorId, amount);

    const source = command.source || "System";

    let message = "";

    if (amount === 1) {
      if (source === "Chest") {
        message = `You found ${armor.name}!`;
      } else {
        message = `You obtained ${armor.name}!`;
      }
    } else {
      if (source === "Chest") {
        message = `You found ${amount} ${armor.name}s!`;
      } else {
        message = `You obtained ${amount} ${armor.name}s!`;
      }
    }

    this.messageWindow.show(message, source);

    this.index++;

    return false;
  }

  commandGainWeapon(command) {
    const amount = Number(command.amount ?? 1);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid weapon amount: ${command.amount}`);

      return true;
    }

    $gameParty.gainWeapon(command.weaponId, amount);

    return true;
  }

  commandGainWeaponMessage(command) {
    if (this.messageWindow.isOpen()) {
      return false;
    }

    const weapon = DatabaseManager.weapon(command.weaponId);

    if (!weapon) {
      console.error(`Unknown weapon ID: ${command.weaponId}`);

      return true;
    }

    const amount = Number(command.amount ?? 1);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid weapon amount: ${command.amount}`);

      return true;
    }

    $gameParty.gainWeapon(command.weaponId, amount);

    const source = command.source || "System";

    let message = "";

    if (amount === 1) {
      if (source === "Chest") {
        message = `You found a ${weapon.name}!`;
      } else {
        message = `You obtained a ${weapon.name}!`;
      }
    } else {
      if (source === "Chest") {
        message = `You found ${amount} ${weapon.name}s!`;
      } else {
        message = `You obtained ${amount} ${weapon.name}s!`;
      }
    }

    this.messageWindow.show(message, source);

    this.index++;

    return false;
  }

  commandGainAccessory(command) {
    const amount = Number(command.amount ?? 1);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid accessory amount: ${command.amount}`);
      return true;
    }

    $gameParty.gainAccessory(command.accessoryId, amount);
    return true;
  }

  commandGainAccessoryMessage(command) {
    if (this.messageWindow.isOpen()) {
      return false;
    }

    const accessory = DatabaseManager.accessory(command.accessoryId);

    if (!accessory) {
      console.error(`Unknown accessory ID: ${command.accessoryId}`);
      return true;
    }

    const amount = Number(command.amount ?? 1);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid accessory amount: ${command.amount}`);
      return true;
    }

    $gameParty.gainAccessory(command.accessoryId, amount);

    const source = command.source || "System";
    const quantity =
      amount === 1 ? `a ${accessory.name}` : `${amount} ${accessory.name}s`;
    const verb = source === "Chest" ? "found" : "obtained";

    this.messageWindow.show(`You ${verb} ${quantity}!`, source);
    this.index++;
    return false;
  }

  commandGainExp(command) {
    const amount = Number(command.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid EXP amount: ${command.amount}`);

      return true;
    }

    const actor = $gameParty.leader();

    if (!actor) {
      console.error("Cannot award EXP because the party has no leader.");
      return true;
    }

    actor.gainExp(amount);

    return true;
  }

  commandGainExpMessage(command) {
    if (this.messageWindow.isOpen()) {
      return false;
    }

    const amount = Number(command.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid EXP amount: ${command.amount}`);

      return true;
    }

    const actor = $gameParty.leader();

    if (!actor) {
      console.error("Cannot award EXP because the party has no leader.");
      return true;
    }

    const levelsGained = actor.gainExp(amount);

    let message = `You gained ${amount} EXP!`;

    if (levelsGained === 1) {
      message += `\n${actor.name} reached Level ${actor.level}!`;
    } else if (levelsGained > 1) {
      message += `\n${actor.name} gained ${levelsGained} levels and reached Level ${actor.level}!`;
    }

    this.messageWindow.show(message, "System");

    this.index++;

    return false;
  }

  commandShop(command) {
    const started = SceneManager.startShop({
      name: command.name || "Shop",
      shopType: command.shopType || "general",
      goods: command.goods || [],
    });

    if (!started) {
      return true;
    }

    // Advance before the shop scene is pushed so returning to this map
    // resumes with the command after the shop instead of reopening it.
    this.index++;

    return false;
  }

  commandBattle(command) {
    const originatingEvent = this.event;

    const started = SceneManager.startBattle(command.encounterId, (result) => {
      this.lastBattleResult = result;

      if (originatingEvent) {
        originatingEvent.lastBattleResult = result;
      }
    });

    if (!started) {
      return true;
    }

    this.index++;
    return false;
  }

  battleResult() {
    return this.lastBattleResult;
  }

  finish() {
    this.running = false;

    this.commands = [];

    this.index = 0;

    this.event = null;

    DebugManager.log("Event finished.");
  }

  isRunning() {
    return this.running;
  }
}
