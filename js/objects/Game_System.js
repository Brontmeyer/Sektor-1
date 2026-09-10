"use strict";

class Game_System {
  constructor() {
    this.actor = new Game_Actor();
    this.party = new Game_Party([this.actor]);

    this.selfSwitches = new Game_SelfSwitches();
    this.switches = new Game_Switches();

    this.variables = new Game_Variables();
  }
}
