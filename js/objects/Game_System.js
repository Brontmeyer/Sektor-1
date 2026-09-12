"use strict";

class Game_System {
  constructor() {
    this.actor = new Game_Actor(1);
    this.actor2 = new Game_Actor(2);
    this.actor3 = new Game_Actor(3);
    this.actor4 = new Game_Actor(4);

    // TEMP
    this.actor2.learnSkill(1);
    this.actor2.learnSkill(2);

    this.actor3.learnSkill(1);
    this.actor3.learnSkill(2);

    this.actor4.learnSkill(1);
    this.actor4.learnSkill(2);
    // TEMP

    this.party = new Game_Party([this.actor, this.actor2, this.actor3, this.actor4]);
    
    this.selfSwitches = new Game_SelfSwitches();
    this.switches = new Game_Switches();

    this.variables = new Game_Variables();
  }
}
