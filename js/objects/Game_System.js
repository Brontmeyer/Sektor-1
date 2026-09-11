"use strict";

class Game_System {
  constructor() {
    this.actor = new Game_Actor(1);
    this.actor2 = new Game_Actor(2);

    this.party = new Game_Party([this.actor, this.actor2]);

    this.selfSwitches = new Game_SelfSwitches();
    this.switches = new Game_Switches();

    this.variables = new Game_Variables();
  }
}
