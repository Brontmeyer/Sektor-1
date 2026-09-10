"use strict";

class Game_Interpreter {
  constructor(messageWindow, choiceWindow) {
    this.messageWindow = messageWindow;
    this.choiceWindow = choiceWindow;

    this.commands = [];

    this.event = null;

    this.index = 0;

    this.running = false;
  }

  setup(commands, event = null) {
    this.commands = JSON.parse(JSON.stringify(commands || []));

    this.event = event;

    this.index = 0;

    this.running = this.commands.length > 0;
  }

  update() {
    if (!this.running) {
      return;
    }

    if (
      this.messageWindow.isOpen() &&
      !this.choiceWindow.isOpen() &&
      !this.choiceWindow.hasResult()
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

      case "gainExp":
        return this.commandGainExp(command);
      case "gainExpMessage":
        return this.commandGainExpMessage(command);

      default:
        console.warn(`Unknown event command: ${command.code}`);

        return true;
    }
  }

  commandText(command) {
    if (this.messageWindow.isOpen()) {
      return;
    }

    this.messageWindow.show(command.text, command.speaker || "");

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

    // Choice window hasn't opened yet.

    if (!this.choiceWindow.isOpen()) {
      const choiceNames = command.choices.map((choice) => choice.text);

      this.messageWindow.show(command.prompt || "", command.speaker || "");

      this.choiceWindow.show(choiceNames);
    }

    // Pause interpreter while waiting
    // for the player.

    return false;
  }

  commandIfSwitch(command) {
    const currentValue = $gameSwitches.value(command.id);

    const expectedValue = command.value === true;

    const branch =
      currentValue === expectedValue
        ? command.trueCommands
        : command.falseCommands;

    const branchCommands = branch || [];

    this.commands.splice(this.index, 1, ...branchCommands);

    return false;
  }

  commandSetSwitch(command) {
    $gameSwitches.setValue(command.id, command.value);

    return true;
  }

  commandSetSelfSwitch(command) {
    if (!this.event) {
      console.error("setSelfSwitch command requires an active event.");

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
    $gameVariables.addValue(command.id, command.value);

    return true;
  }

  commandGainItem(command) {
    $gameParty.gainItem(command.itemId, command.amount || 1);

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

    const amount = command.amount || 1;

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

  commandGainExp(command) {
    const amount = Number(command.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`Invalid EXP amount: ${command.amount}`);

      return true;
    }

    $gameActor.gainExp(amount);

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

    const levelsGained = $gameActor.gainExp(amount);

    let message = `You gained ${amount} EXP!`;

    if (levelsGained === 1) {
      message += `\n${$gameActor.name} reached Level ${$gameActor.level}!`;
    } else if (levelsGained > 1) {
      message += `\n${$gameActor.name} gained ${levelsGained} levels and reached Level ${$gameActor.level}!`;
    }

    this.messageWindow.show(message, "System");

    this.index++;

    return false;
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
