"use strict";

class Game_Enemy extends Game_Battler {
  constructor(enemyId) {
    const enemyData = DatabaseManager.enemy(enemyId);

    if (!enemyData) {
      throw new Error(`Enemy ${enemyId} does not exist.`);
    }

    super(enemyData);

    this.enemyId = enemyId;
    this.expReward = enemyData.expReward ?? 0;
    this.banished = false;
    this.battleSprite = enemyData.battleSprite || null;
    this.battleSpriteWidth = enemyData.battleSpriteWidth || 128;
    this.battleSpriteHeight = enemyData.battleSpriteHeight || 128;
    this.battleSpriteFrames = enemyData.battleSpriteFrames || 1;
    this.battleSpriteRows = enemyData.battleSpriteRows || 1;
  }

  banish() {
    if (this.isDefeated()) {
      return {
        success: false,
        alreadyDefeated: true,
        banished: this.banished === true,
      };
    }

    this.banished = true;

    // The canonical Death status is the shared bridge into defeated-state
    // handling. It sets HP to zero and participates in all normal battle
    // targeting/outcome logic, while the separate banished flag preserves the
    // reward-specific reason for future currency handling.
    const appliedDeath = this.addStatus("death");
    const success = appliedDeath || this.isDefeated();

    return {
      success,
      alreadyDefeated: false,
      banished: this.banished,
    };
  }

  isBanished() {
    return this.banished === true;
  }

  canBeRevived() {
    if (this.isBanished()) {
      return false;
    }

    return super.canBeRevived();
  }
}
