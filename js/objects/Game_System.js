"use strict";

class Game_System {
  constructor() {
    this.switches = new Game_Switches();

    this.variables = new Game_Variables();

    this.selfSwitches = new Game_SelfSwitches();

    this.actor = new Game_Actor();

    this.party = new Game_Party();
  }
}
