"use strict";

class BattlePartyController {
  constructor(scene) {
    this.scene = scene;

    this.partyTurnQueue = [];
    this.currentPartyTurn = 0;
    this.activeBattler = null;
  }

  // =================================
  // Party Turn Queue Management
  // =================================

  initializePartyTurnQueue() {
    this.partyTurnQueue = $gameParty.livingBattleMembers();
    this.currentPartyTurn = 0;
    this.activeBattler = this.partyTurnQueue[0] || null;
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

  battlePosition(index) {
    const positions = this.formationPositions();
    const safeIndex = Math.max(0, Math.min(index, positions.length - 1));

    return positions[safeIndex];
  }

  formationPositions() {
    const battlefieldBottom = Graphics.height - 190;

    return [
      // Tyler - upper left
      { x: 400, y: battlefieldBottom - 180 },

      // Sarah - middle left
      { x: 140, y: battlefieldBottom - 180 },

      // Aboo - middle right
      { x: 260, y: battlefieldBottom - 310 },

      // G Prime - lower left/center
      { x: 260, y: battlefieldBottom - 50 },
    ];
  }

  positionForBattler(battler) {
    const index = $gameParty.battleMemberIndex(battler);

    if (index < 0) {
      return this.battlePosition(0);
    }

    return this.battlePosition(index);
  }

  currentBattler() {
    return this.activeBattler;
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

  resetPartyTurnQueue() {
    for (const battler of $gameParty.battleMembers()) {
      battler.stopDefending();
    }

    this.partyTurnQueue = $gameParty.livingBattleMembers();
    this.currentPartyTurn = 0;
    this.activeBattler = this.partyTurnQueue[0] || null;
  }
}
