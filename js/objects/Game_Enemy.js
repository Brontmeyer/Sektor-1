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
    this.gilReward = enemyData.gilReward ?? 0;
    this.resonanceReward = enemyData.resonanceReward ?? 0;
    this.dropTable = Array.isArray(enemyData.dropTable)
      ? enemyData.dropTable.map((drop) => ({ ...drop }))
      : [];
    this.actions = Array.isArray(enemyData.actions)
      ? enemyData.actions.map((action) => ({
          ...action,
          condition: action.condition ? { ...action.condition } : null,
        }))
      : [];
    this.banished = false;
    this.battleSprite = enemyData.battleSprite || null;
    this.battleSpriteWidth = enemyData.battleSpriteWidth || 128;
    this.battleSpriteHeight = enemyData.battleSpriteHeight || 128;
    this.battleSpriteFrames = enemyData.battleSpriteFrames || 1;
    this.battleSpriteRows = enemyData.battleSpriteRows || 1;
  }

  actionDefinitions() {
    return this.actions.map((action) => ({
      ...action,
      condition: action.condition ? { ...action.condition } : null,
    }));
  }

  knowsMagick(magickId) {
    const id = Number(magickId);
    return this.actions.some(
      (action) => action.type === "magick" && Number(action.magickId) === id,
    );
  }

  knowsSkill(skillId) {
    const id = Number(skillId);
    return this.actions.some(
      (action) => action.type === "skill" && Number(action.skillId) === id,
    );
  }

  canPaySkillCost(skill) {
    if (skill?.valorArt === true) {
      return false;
    }

    return super.canPaySkillCost(skill);
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
