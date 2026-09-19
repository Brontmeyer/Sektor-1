"use strict";

class Game_System {
  constructor() {
    this.actors = DatabaseManager.actors
      .filter((actorData) => actorData !== null)
      .map((actorData) => new Game_Actor(actorData.id));

    this.party = new Game_Party(this.actors);

    this.selfSwitches = new Game_SelfSwitches();
    this.switches = new Game_Switches();

    this.variables = new Game_Variables();
  }
}
