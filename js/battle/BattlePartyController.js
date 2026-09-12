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
    while (this.hasNextBattler()) {
      this.currentPartyTurn++;

      const battler = this.partyTurnQueue[this.currentPartyTurn] || null;

      if (battler && !battler.isDead()) {
        this.activeBattler = battler;
        return battler;
      }
    }

    this.activeBattler = null;
    return null;
  }

  resetPartyTurnQueue() {
    for (const battler of $gameParty.battleMembers()) {
      battler.stopDefending();
    }
    
    this.partyTurnQueue = $gameParty.livingBattleMembers();
    this.currentPartyTurn = 0;
    this.activeBattler = this.partyTurnQueue[0] || null;
  }

  hasNextBattler() {
    for (
      let i = this.currentPartyTurn + 1;
      i < this.partyTurnQueue.length;
      i++
    ) {
      const battler = this.partyTurnQueue[i];

      if (battler && !battler.isDead()) {
        return true;
      }
    }

    return false;
  }

  // =============================================================
  // Pass 10 - Party Battlefield Foundation
  // =============================================================

  formationPositions() {
    const battlefieldBottom = Graphics.height - 190;

    return [
      // Tyler - upper left
      { x: 400, y: battlefieldBottom - 180 },

      // Party Test - middle left
      { x: 140, y: battlefieldBottom - 180 },

      // Party Test 2 - middle right
      { x: 260, y: battlefieldBottom - 310 },

      // Party Test 3 - lower left/center
      { x: 260, y: battlefieldBottom - 50 },
    ];
  }

  battlePosition(index) {
    const positions = this.formationPositions();
    const safeIndex = Math.max(0, Math.min(index, positions.length - 1));

    return positions[safeIndex];
  }

  positionForBattler(battler) {
    const index = $gameParty.battleMemberIndex(battler);

    if (index < 0) {
      return this.battlePosition(0);
    }

    return this.battlePosition(index);
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
