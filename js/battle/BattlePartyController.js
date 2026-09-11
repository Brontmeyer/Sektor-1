class BattlePartyController {
  constructor(scene) {
    this.scene = scene;

    this.partyTurnQueue = [];
    this.currentPartyTurn = 0;
    this.activeBattler = null;
  }

  currentBattler() {
    return this.activeBattler;
  }

  initializePartyTurnQueue() {
    this.partyTurnQueue = $gameParty.livingBattleMembers();
    this.currentPartyTurn = 0;
    this.activeBattler = this.partyTurnQueue[0] || null;
  }

  nextBattler() {
    if (this.hasNextBattler()) {
      this.currentPartyTurn++;
      this.activeBattler = this.partyTurnQueue[this.currentPartyTurn] || null;
      return this.activeBattler;
    }
    return null;
  }

  resetPartyTurnQueue() {
    this.partyTurnQueue = $gameParty.livingBattleMembers();
    this.currentPartyTurn = 0;
    this.activeBattler = this.partyTurnQueue[0] || null;
  }

  hasNextBattler() {
    return this.currentPartyTurn < this.partyTurnQueue.length - 1;
  }

  battleContext() {
    return {
      battler: this.currentBattler(),
      turnState: this.scene.battleManager.currentTurnState(),
      turnIndex: this.currentPartyTurn,
      partySize: this.partyTurnQueue.length,
      isFirstTurn: this.currentPartyTurn === 0,
      isLastTurn: this.currentPartyTurn === this.partyTurnQueue.length - 1,
    };
  }
}
