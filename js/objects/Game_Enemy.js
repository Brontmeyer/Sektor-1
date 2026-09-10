"use strict";

class Game_Enemy extends Game_Battler {
  constructor(enemyId) {
    const enemyData = DatabaseManager.enemy(enemyId);

    if (!enemyData) {
      throw new Error(`Enemy ${enemyId} does not exist.`);
    }

    super(enemyData);

    this.enemyId = enemyId;
    this.battleSprite = enemyData.battleSprite || null;
    this.battleSpriteWidth = enemyData.battleSpriteWidth || 128;
    this.battleSpriteHeight = enemyData.battleSpriteHeight || 128;
    this.battleSpriteFrames = enemyData.battleSpriteFrames || 1;
    this.battleSpriteRows = enemyData.battleSpriteRows || 1;
  }
}
