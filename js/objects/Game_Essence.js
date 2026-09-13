"use strict";

class Game_Essence {
  constructor(essenceId) {
    this.essenceId = essenceId;
    this.resonance = 0;
  }

  data() {
    return DatabaseManager.essence(this.essenceId);
  }

  name() {
    return this.data()?.name || "Unknown Essence";
  }

  level() {
    const essence = this.data();

    if (!essence?.levels?.length) {
      return 1;
    }

    let currentLevel = 1;

    for (const levelData of essence.levels) {
      if (this.resonance >= levelData.resonanceRequired) {
        currentLevel = levelData.level;
      }
    }

    return currentLevel;
  }

  addResonance(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    const oldLevel = this.level();

    const oldSkillIds = new Set(this.unlockedSkills().map((skill) => skill.id));

    this.resonance += value;

    const newLevel = this.level();

    const awakenedSkills = this.unlockedSkills().filter(
      (skill) => !oldSkillIds.has(skill.id),
    );

    return {
      gained: value,
      oldLevel,
      newLevel,
      leveledUp: newLevel > oldLevel,
      awakenedSkills,
    };
  }

  unlockedAbilities() {
    const essence = this.data();

    if (!essence?.abilities?.length) {
      return [];
    }

    const currentLevel = this.level();

    return essence.abilities.filter(
      (ability) => ability.unlockLevel <= currentLevel,
    );
  }

  unlockedSkills() {
    return this.unlockedAbilities()
      .map((ability) => DatabaseManager.skill(ability.skillId))
      .filter((skill) => skill);
  }
}
