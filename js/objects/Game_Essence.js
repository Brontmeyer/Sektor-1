"use strict";

class Game_Essence {
  constructor(essenceId, resonance = 0) {
    this.essenceId = Number(essenceId);
    this.resonance = 0;
    this.setResonance(resonance);
  }

  data() {
    return DatabaseManager.essence(this.essenceId);
  }

  name() {
    return this.data()?.name || "Unknown Essence";
  }

  masteryThreshold() {
    const threshold = Number(this.data()?.mastery?.resonanceRequired);
    return Number.isFinite(threshold) && threshold >= 0 ? threshold : 1500;
  }

  setResonance(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value < 0) {
      return false;
    }

    this.resonance = Math.min(this.masteryThreshold(), value);
    return true;
  }

  isMasteryReady() {
    return this.resonance >= this.masteryThreshold();
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

    const oldResonance = this.resonance;
    const oldLevel = this.level();
    const masteryReadyBefore = this.isMasteryReady();
    const oldSkillIds = new Set(this.unlockedSkills().map((skill) => skill.id));

    this.resonance = Math.min(this.masteryThreshold(), this.resonance + value);

    const newLevel = this.level();
    const masteryReadyAfter = this.isMasteryReady();
    const awakenedSkills = this.unlockedSkills().filter(
      (skill) => !oldSkillIds.has(skill.id),
    );

    return {
      gained: this.resonance - oldResonance,
      oldResonance,
      newResonance: this.resonance,
      oldLevel,
      newLevel,
      leveledUp: newLevel > oldLevel,
      masteryReadyBefore,
      masteryReadyAfter,
      becameMasteryReady: !masteryReadyBefore && masteryReadyAfter,
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
