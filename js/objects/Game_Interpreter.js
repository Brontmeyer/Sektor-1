"use strict";

class Game_Interpreter {
  constructor(messageWindow, choiceWindow) {
    this.messageWindow = messageWindow;
    this.choiceWindow = choiceWindow;

    this.commands = [];

    this.index = 0;

    this.running = false;
  }

  setup(commands) {
    this.commands = JSON.parse(JSON.stringify(commands || []));

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

      case "setSwitch":
        return this.commandSetSwitch(command);

      case "setVariable":
        return this.commandSetVariable(command);

      case "addVariable":
        return this.commandAddVariable(command);

      case "ifSwitch":
        return this.commandIfSwitch(command);

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

      console.log(`Choice selected: ${selectedChoice.text}`);

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

  commandSetSwitch(command) {
    $gameSwitches.setValue(command.id, command.value);

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

  finish() {
    this.running = false;

    this.commands = [];

    this.index = 0;

    console.log("Event finished.");
  }

  isRunning() {
    return this.running;
  }
}
