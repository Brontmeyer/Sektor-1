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
    this.runeReward = enemyData.runeReward ?? 0;
    this.resonanceReward = enemyData.resonanceReward ?? 0;
    this.dropTable = Array.isArray(enemyData.dropTable)
      ? enemyData.dropTable.map((drop) => ({ ...drop }))
      : [];
    this.actions = this.cloneActions(enemyData.actions);
    this.phases = Array.isArray(enemyData.phases)
      ? enemyData.phases.map((phase) => ({
          ...phase,
          actions: this.cloneActions(phase.actions),
        }))
      : [];
    this.phaseIndex = 0;
    this.banished = false;
    const battleVisual = this.configureBattleVisual(enemyData, {
      spriteKey: "battleSprite",
      defaultWidth: 128,
      defaultHeight: 128,
      defaultShadowRatio: 0.78,
      defaultShadowHeightRatio: 0.12,
    });

    this.battleSprite = battleVisual.sprite;
    this.battleSpriteWidth = battleVisual.width;
    this.battleSpriteHeight = battleVisual.height;
    this.battleSpriteFrames = battleVisual.sheet.columns;
    this.battleSpriteRows = battleVisual.sheet.rows;
    this.battleSpriteGroundOffset = battleVisual.groundOffset;
    this.battleFootprintWidth = battleVisual.footprintWidth;
    this.battleShadowWidth = battleVisual.shadow.width;
    this.battleShadowHeight = battleVisual.shadow.height;
  }

  cloneActions(actions) {
    return Array.isArray(actions)
      ? actions.map((action) => ({
          ...action,
          condition: action.condition ? { ...action.condition } : null,
        }))
      : [];
  }

  phaseDefinitions() {
    return this.phases.map((phase) => ({
      ...phase,
      actions: this.cloneActions(phase.actions),
    }));
  }

  currentPhase() {
    return this.phases[this.phaseIndex] || null;
  }

  refreshPhase() {
    const previousPhase = this.currentPhase();

    if (!previousPhase || this.isDefeated()) {
      return {
        changed: false,
        from: previousPhase,
        to: previousPhase,
      };
    }

    let nextIndex = this.phaseIndex;
    const hpRate = this.hpRate();

    for (let index = this.phaseIndex + 1; index < this.phases.length; index++) {
      const threshold = Number(this.phases[index]?.hpRateAtOrBelow);

      if (!Number.isFinite(threshold) || hpRate > threshold) {
        break;
      }

      nextIndex = index;
    }

    if (nextIndex === this.phaseIndex) {
      return {
        changed: false,
        from: previousPhase,
        to: previousPhase,
      };
    }

    this.phaseIndex = nextIndex;

    return {
      changed: true,
      from: previousPhase,
      to: this.currentPhase(),
    };
  }

  actionDefinitions() {
    const phase = this.currentPhase();
    return this.cloneActions(phase ? phase.actions : this.actions);
  }

  allActionDefinitions() {
    if (this.phases.length > 0) {
      return this.phases.flatMap((phase) => this.cloneActions(phase.actions));
    }

    return this.cloneActions(this.actions);
  }

  knowsMagick(magickId) {
    const id = Number(magickId);
    return this.allActionDefinitions().some(
      (action) => action.type === "magick" && Number(action.magickId) === id,
    );
  }

  knowsEnemySkill(enemySkillId) {
    const id = Number(enemySkillId);
    return this.allActionDefinitions().some(
      (action) =>
        action.type === "enemySkill" && Number(action.enemySkillId) === id,
    );
  }

  canUseEnemySkill(enemySkillId) {
    const id = Number(enemySkillId);
    const skill = DatabaseManager.enemySkill?.(id) || null;

    if (!skill || !this.knowsEnemySkill(id)) {
      return false;
    }

    return this.canUseSkillDefinition(skill) && this.canPaySkillCost(skill);
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
