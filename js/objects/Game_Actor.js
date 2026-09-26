"use strict";

class Game_Actor extends Game_Battler {
  static NAME_MAX_LENGTH = 16;

  static isAllowedNameCharacter(character) {
    return /^\p{L}$/u.test(String(character || ""));
  }

  static isAllowedNameSeparator(character) {
    return character === " ";
  }

  static normalizeName(value) {
    const normalized = String(value ?? "").normalize("NFKC");
    let text = "";

    for (const character of Array.from(normalized)) {
      if (this.isAllowedNameCharacter(character)) {
        text += character;
      } else if (/\s/.test(character)) {
        text += " ";
      } else if (this.isAllowedNameSeparator(character)) {
        text += character;
      }
    }

    text = text.replace(/\s+/g, " ").trim();

    return Array.from(text).slice(0, Game_Actor.NAME_MAX_LENGTH).join("");
  }

  constructor(actorId = 1) {
    const actorData = DatabaseManager.actor(actorId);

    if (!actorData) {
      throw new Error(`Actor ID ${actorId} does not exist.`);
    }

    super(actorData);

    this.actorId = actorId;
    this._defaultName = Game_Actor.normalizeName(actorData.name) || `Actor ${actorId}`;
    this.name = this._defaultName;
    this.sideBattleSprite = actorData.sideBattleSprite || null;
    this.battleSpriteWidth = actorData.battleSpriteWidth || 96;
    this.battleSpriteHeight = actorData.battleSpriteHeight || 128;
    this.battleSpriteFrames = actorData.battleSpriteFrames || 1;
    this.battleSpriteRows = actorData.battleSpriteRows || 1;

    this.exp = actorData.exp;
    this.growth = actorData.growth;

    this.maxValor = actorData.maxValor;
    this.valor = 0;
    this._selectedValorLevel = 1;

    this.weaponId = 0;
    this.armorId = 0;
    this.accessoryId = 0;

    this.magickIds = Array.isArray(actorData.initialMagickIds)
      ? [...actorData.initialMagickIds]
      : [];
    this.skillIds = Array.isArray(actorData.initialSkillIds)
      ? [...actorData.initialSkillIds]
      : [];
    this.valorArtIds = Array.isArray(actorData.initialValorArtIds)
      ? [...actorData.initialValorArtIds]
      : [];

    // Essence progression belongs to the actor, while equipment slots only
    // reference those persistent runtime instances. This keeps Resonance intact
    // when an Essence is temporarily unequipped.
    this._essenceSlotCount = actorData.essenceSlots;
    this._essenceProgress = new Map();
    this._equippedEssenceIds = Array(this._essenceSlotCount).fill(null);
  }

  // =====================================
  // Identity
  // =====================================

  defaultName() {
    return this._defaultName;
  }

  nameMaxLength() {
    return Game_Actor.NAME_MAX_LENGTH;
  }

  rename(value) {
    const name = Game_Actor.normalizeName(value);

    if (!name) {
      return false;
    }

    this.name = name;
    return true;
  }

  resetName() {
    this.name = this._defaultName;
    return this.name;
  }

  // =====================================
  // Valor Runtime
  // =====================================

  valorRate() {
    if (!Number.isFinite(this.maxValor) || this.maxValor <= 0) {
      return 0;
    }

    return this.valor / this.maxValor;
  }

  isValorReady() {
    return this.maxValor > 0 && this.valor >= this.maxValor;
  }

  selectedValorLevel() {
    const current = Number(this._selectedValorLevel);

    if (
      Number.isInteger(current) &&
      current >= 1 &&
      current <= 4 &&
      this.valorArtsForLevel(current).length > 0
    ) {
      return current;
    }

    const fallback = this.knownValorArts()[0];
    const fallbackLevel = fallback ? this.valorArtLevel(fallback) : 1;
    this._selectedValorLevel = fallbackLevel;
    return fallbackLevel;
  }

  canSetValorLevel(level) {
    const resolved = Number(level);
    return (
      Number.isInteger(resolved) &&
      resolved >= 1 &&
      resolved <= 4 &&
      this.valorArtsForLevel(resolved).length > 0
    );
  }

  setValorLevel(level) {
    const resolved = Number(level);

    if (!this.canSetValorLevel(resolved)) {
      return false;
    }

    // Changing the prepared Valor level never discards gauge already earned.
    this._selectedValorLevel = resolved;
    return true;
  }

  selectedValorArts() {
    return this.valorArtsForLevel(this.selectedValorLevel());
  }

  isValorSurgeReady() {
    return this.isValorReady() && this.selectedValorArts().length > 0;
  }

  setValor(value) {
    const numeric = Number(value);
    const resolved = Number.isFinite(numeric) ? numeric : 0;

    const bounded = Math.max(0, Math.min(resolved, this.maxValor));
    this.valor = Math.round(bounded * 1000) / 1000;
    return this.valor;
  }

  gainValor(amount) {
    const numeric = Number(amount);

    if (!Number.isFinite(numeric) || numeric <= 0 || this.isValorReady()) {
      return 0;
    }

    const before = this.valor;
    this.setValor(this.valor + numeric);
    return this.valor - before;
  }

  consumeValor() {
    if (!this.isValorReady()) {
      return false;
    }

    this.valor = 0;
    return true;
  }

  gainValorFromDamage(damage) {
    const resolvedDamage = Number(damage);

    if (
      !Number.isFinite(resolvedDamage) ||
      resolvedDamage <= 0 ||
      this.maxHp <= 0 ||
      !this.isAlive()
    ) {
      return 0;
    }

    const baseGain = (resolvedDamage / this.maxHp) * this.maxValor;
    const multiplier = this.valorGainMultiplier();

    return this.gainValor(baseGain * multiplier);
  }

  onDamageReceived(result) {
    if (result?.valorEligible !== true) {
      return 0;
    }

    return this.gainValorFromDamage(result?.damage ?? 0);
  }

  // =====================================
  // Essence Equipment / Progression
  // =====================================

  essenceSlotCount() {
    return this._essenceSlotCount;
  }

  essenceProgress(essenceId) {
    const id = Number(essenceId);
    return this._essenceProgress.get(id) || null;
  }

  ensureEssenceProgress(essenceId, resonance = 0) {
    const id = Number(essenceId);

    if (!Number.isInteger(id) || id <= 0 || !DatabaseManager.essence(id)) {
      return null;
    }

    const existing = this.essenceProgress(id);

    if (existing) {
      return existing;
    }

    const essence = new Game_Essence(id, resonance);
    this._essenceProgress.set(id, essence);
    return essence;
  }

  essenceProgressStates() {
    return [...this._essenceProgress.values()]
      .sort((a, b) => a.essenceId - b.essenceId)
      .map((essence) => ({
        essenceId: essence.essenceId,
        resonance: essence.resonance,
      }));
  }

  equippedEssenceIds() {
    return [...this._equippedEssenceIds];
  }

  equippedEssenceAt(slotIndex) {
    const slot = Number(slotIndex);

    if (!Number.isInteger(slot) || slot < 0 || slot >= this._essenceSlotCount) {
      return null;
    }

    const essenceId = this._equippedEssenceIds[slot];
    return essenceId ? this.essenceProgress(essenceId) : null;
  }

  equippedEssences() {
    return this._equippedEssenceIds
      .map((essenceId) => (essenceId ? this.essenceProgress(essenceId) : null))
      .filter((essence) => essence !== null);
  }

  equippedEssence(essenceId) {
    const id = Number(essenceId);

    if (!this._equippedEssenceIds.includes(id)) {
      return null;
    }

    return this.essenceProgress(id);
  }

  equippedEssenceSlot(essenceId) {
    const id = Number(essenceId);
    return this._equippedEssenceIds.indexOf(id);
  }

  canEquipEssenceInSlot(slotIndex, essenceId) {
    const slot = Number(slotIndex);
    const id = Number(essenceId);

    if (
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= this._essenceSlotCount ||
      !Number.isInteger(id) ||
      id <= 0 ||
      !DatabaseManager.essence(id)
    ) {
      return false;
    }

    const equippedSlot = this.equippedEssenceSlot(id);
    return equippedSlot < 0 || equippedSlot === slot;
  }

  equipEssenceInSlot(slotIndex, essenceId, resonance = 0) {
    const slot = Number(slotIndex);
    const id = Number(essenceId);

    if (!this.canEquipEssenceInSlot(slot, id)) {
      return false;
    }

    const essence = this.ensureEssenceProgress(id, resonance);

    if (!essence) {
      return false;
    }

    this._equippedEssenceIds[slot] = id;
    return true;
  }

  equipEssence(essenceId, resonance = 0) {
    const id = Number(essenceId);

    if (this.equippedEssence(id)) {
      return false;
    }

    const openSlot = this._equippedEssenceIds.indexOf(null);

    if (openSlot < 0) {
      return false;
    }

    return this.equipEssenceInSlot(openSlot, id, resonance);
  }

  unequipEssenceSlot(slotIndex) {
    const slot = Number(slotIndex);

    if (
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= this._essenceSlotCount ||
      this._equippedEssenceIds[slot] === null
    ) {
      return false;
    }

    this._equippedEssenceIds[slot] = null;
    return true;
  }

  unequipEssence(essenceId) {
    const slot = this.equippedEssenceSlot(essenceId);
    return slot >= 0 ? this.unequipEssenceSlot(slot) : false;
  }

  // Backward-compatible shape used by older battle/save tests and v4 saves.
  equippedEssenceStates() {
    return this.equippedEssences().map((essence) => ({
      essenceId: essence.essenceId,
      resonance: essence.resonance,
    }));
  }

  restoreEssenceLoadout(progressStates, equippedIds) {
    this._essenceProgress = new Map();
    this._equippedEssenceIds = Array(this._essenceSlotCount).fill(null);

    if (Array.isArray(progressStates)) {
      for (const state of progressStates) {
        const essence = this.ensureEssenceProgress(
          state?.essenceId,
          state?.resonance ?? 0,
        );

        if (!essence) {
          continue;
        }
      }
    }

    if (!Array.isArray(equippedIds)) {
      return;
    }

    const slotLimit = Math.min(this._essenceSlotCount, equippedIds.length);

    for (let slot = 0; slot < slotLimit; slot++) {
      const essenceId = Number(equippedIds[slot]);

      if (!Number.isInteger(essenceId) || essenceId <= 0) {
        continue;
      }

      this.equipEssenceInSlot(slot, essenceId);
    }
  }

  restoreEquippedEssenceStates(states) {
    const legacyStates = Array.isArray(states) ? states : [];
    this.restoreEssenceLoadout(
      legacyStates,
      legacyStates.map((state) => state?.essenceId ?? null),
    );
  }

  gainEquippedEssenceResonance(amount) {
    const results = [];

    for (const essence of this.equippedEssences()) {
      const progression = essence.addResonance(amount);

      if (!progression) {
        continue;
      }

      results.push({
        essenceId: essence.essenceId,
        name: essence.name(),
        ...progression,
        awakenedMagickIds: progression.awakenedMagick.map((magick) => magick.id),
      });
    }

    return results;
  }

  // =====================================
  // Equipment Management
  // =====================================

  weapon() {
    if (this.weaponId <= 0) {
      return null;
    }
    return DatabaseManager.weapon(this.weaponId);
  }

  armor() {
    if (this.armorId <= 0) {
      return null;
    }

    return DatabaseManager.armor(this.armorId);
  }

  accessory() {
    if (this.accessoryId <= 0) {
      return null;
    }

    return DatabaseManager.accessory(this.accessoryId);
  }

  accessoryBonus(key, accessory = this.accessory()) {
    const value = Number(accessory?.bonuses?.[key]);
    return Number.isFinite(value) ? value : 0;
  }

  equipWeapon(weaponId) {
    const weapon = DatabaseManager.weapon(weaponId);

    if (!weapon) {
      console.error(`Weapon ID ${weaponId} does not exist.`);

      return false;
    }
    this.weaponId = weaponId;

    DebugManager.log(`${this.name} equipped ${weapon.name}.`);

    return true;
  }

  equipArmor(armorId) {
    const armor = DatabaseManager.armor(armorId);

    if (!armor) {
      console.error(`Armor ID ${armorId} does not exist.`);

      return false;
    }
    this.armorId = armorId;

    DebugManager.log(`${this.name} equipped ${armor.name}.`);

    return true;
  }

  equipAccessory(accessoryId) {
    const accessory = DatabaseManager.accessory(accessoryId);

    if (!accessory) {
      console.error(`Accessory ID ${accessoryId} does not exist.`);
      return false;
    }

    this.accessoryId = accessoryId;
    DebugManager.log(`${this.name} equipped ${accessory.name}.`);
    return true;
  }

  unequipWeapon() {
    const weapon = this.weapon();

    if (!weapon) {
      return false;
    }

    this.weaponId = 0;
    DebugManager.log(`${this.name} unequipped ${weapon.name}.`);
    return true;
  }

  unequipArmor() {
    const armor = this.armor();

    if (!armor) {
      return false;
    }

    this.armorId = 0;
    DebugManager.log(`${this.name} unequipped ${armor.name}.`);
    return true;
  }

  unequipAccessory() {
    const accessory = this.accessory();

    if (!accessory) {
      return false;
    }

    this.accessoryId = 0;
    DebugManager.log(`${this.name} unequipped ${accessory.name}.`);
    return true;
  }

  // =====================================
  // Magick Management
  // =====================================

  learnMagick(magickId) {
    if (!DatabaseManager.magick(magickId)) {
      console.warn(`Cannot learn magick ${magickId}: magick does not exist.`);
      return false;
    }

    if (this.knowsMagick(magickId)) {
      return false;
    }

    this.magickIds.push(magickId);

    DebugManager.log(
      `${this.name} learned ${DatabaseManager.magickName(magickId)}.`,
    );

    return true;
  }

  forgetMagick(magickId) {
    const index = this.magickIds.indexOf(magickId);

    if (index === -1) {
      return false;
    }

    this.magickIds.splice(index, 1);

    DebugManager.log(
      `${this.name} forgot ${DatabaseManager.magickName(magickId)}.`,
    );

    return true;
  }

  knowsMagick(magickId) {
    return this.magickIds.includes(magickId);
  }

  knownMagick() {
    return this.magickIds
      .map((magickId) => DatabaseManager.magick(magickId))
      .filter((magick) => magick !== null);
  }


  // =====================================
  // Skill Management
  // =====================================

  learnSkill(skillId) {
    const id = Number(skillId);

    if (!Number.isInteger(id) || id <= 0 || !DatabaseManager.skill(id)) {
      console.warn(`Cannot learn skill ${skillId}: skill does not exist.`);
      return false;
    }

    if (this.knowsSkill(id)) {
      return false;
    }

    this.skillIds.push(id);
    DebugManager.log(`${this.name} learned ${DatabaseManager.skillName(id)}.`);
    return true;
  }

  forgetSkill(skillId) {
    const id = Number(skillId);
    const index = this.skillIds.indexOf(id);

    if (index === -1) {
      return false;
    }

    this.skillIds.splice(index, 1);
    DebugManager.log(`${this.name} forgot ${DatabaseManager.skillName(id)}.`);
    return true;
  }

  knowsSkill(skillId) {
    return this.skillIds.includes(Number(skillId));
  }

  knownSkills() {
    return this.skillIds
      .map((skillId) => DatabaseManager.skill(skillId))
      .filter((skill) => skill !== null);
  }

  isValorArt(art) {
    return art?.type === "valor";
  }

  valorArtLevel(art) {
    if (!this.isValorArt(art)) {
      return 0;
    }

    const level = Number(art?.valorLevel);
    return Number.isInteger(level) && level >= 1 && level <= 4 ? level : 1;
  }

  learnValorArt(valorArtId) {
    const id = Number(valorArtId);

    if (!Number.isInteger(id) || id <= 0 || !DatabaseManager.valorArt?.(id)) {
      console.warn(`Cannot learn Valor Art ${valorArtId}: Valor Art does not exist.`);
      return false;
    }

    if (this.knowsValorArt(id)) {
      return false;
    }

    this.valorArtIds.push(id);
    DebugManager.log(`${this.name} learned ${DatabaseManager.valorArtName(id)}.`);
    return true;
  }

  forgetValorArt(valorArtId) {
    const id = Number(valorArtId);
    const index = this.valorArtIds.indexOf(id);

    if (index === -1) {
      return false;
    }

    this.valorArtIds.splice(index, 1);
    DebugManager.log(`${this.name} forgot ${DatabaseManager.valorArtName(id)}.`);
    return true;
  }

  knowsValorArt(valorArtId) {
    return this.valorArtIds.includes(Number(valorArtId));
  }

  knownValorArts() {
    return this.valorArtIds
      .map((valorArtId) => DatabaseManager.valorArt?.(valorArtId) || null)
      .filter((art) => art !== null)
      .sort((left, right) => {
        const levelDifference = this.valorArtLevel(left) - this.valorArtLevel(right);
        return levelDifference !== 0
          ? levelDifference
          : (Number(left?.id) || 0) - (Number(right?.id) || 0);
      });
  }

  valorArtsForLevel(level) {
    const resolvedLevel = Number(level);

    if (!Number.isInteger(resolvedLevel) || resolvedLevel < 1 || resolvedLevel > 4) {
      return [];
    }

    return this.knownValorArts().filter(
      (art) => this.valorArtLevel(art) === resolvedLevel,
    );
  }

  highestKnownValorLevel() {
    return this.knownValorArts().reduce(
      (highest, art) => Math.max(highest, this.valorArtLevel(art)),
      0,
    );
  }

  canUseValorArt(valorArtId) {
    const art = DatabaseManager.valorArt?.(Number(valorArtId)) || null;

    return (
      art !== null &&
      this.knowsValorArt(valorArtId) &&
      this.canUseBattleAction("skill") &&
      this.canPayValorArtCost(art)
    );
  }

  canPayValorArtCost(art) {
    return (
      this.isValorArt(art) &&
      this.isValorSurgeReady() &&
      this.valorArtLevel(art) === this.selectedValorLevel()
    );
  }

  payValorArtCost(art) {
    if (!this.canPayValorArtCost(art)) {
      return false;
    }

    return this.consumeValor();
  }

  // =====================================
  // Experience and Level Management
  // =====================================

  gainExp(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      console.error(`Invalid EXP amount: ${amount}`);

      return 0;
    }

    this.exp += value;
    DebugManager.log(`${this.name} gained ${value} EXP.`);
    const oldLevel = this.level;
    this.checkLevelUp();

    return this.level - oldLevel;
  }

  expForNextLevel() {
    return this.level * 100;
  }

  checkLevelUp() {
    while (this.exp >= this.expForNextLevel()) {
      const requiredExp = this.expForNextLevel();
      this.exp -= requiredExp;

      this.levelUp();
    }
  }

  levelUp() {
    this.level++;

    this.maxHp += this.growth.maxHp;
    this.maxMp += this.growth.maxMp;

    this.strength += this.growth.strength;
    this.vitality += this.growth.vitality;
    this.dexterity += this.growth.dexterity;
    this.agility += this.growth.agility;
    this.magic += this.growth.magic;
    this.spirit += this.growth.spirit;
    this.luck += this.growth.luck;

    this.attack += this.growth.attack;
    this.defense += this.growth.defense;

    this.magicAttack += this.growth.magicAttack;
    this.magicDefense += this.growth.magicDefense;

    this.hp = this.maxHp;
    this.mp = this.maxMp;

    DebugManager.log(`${this.name} reached Level ${this.level}!`);

    DebugManager.log(`Max HP: ${this.maxHp}`);
    DebugManager.log(`Max MP: ${this.maxMp}`);

    DebugManager.log(`Strength: ${this.strength}`);
    DebugManager.log(`Vitality: ${this.vitality}`);
    DebugManager.log(`Dexterity: ${this.dexterity}`);
    DebugManager.log(`Agility: ${this.agility}`);
    DebugManager.log(`Magic: ${this.magic}`);
    DebugManager.log(`Spirit: ${this.spirit}`);
    DebugManager.log(`Luck: ${this.luck}`);

    DebugManager.log(`Attack: ${this.attack}`);
    DebugManager.log(`Defense: ${this.defense}`);

    DebugManager.log(`Magic Attack: ${this.magicAttack}`);
    DebugManager.log(`Magic Defense: ${this.magicDefense}`);
  }

  // =====================================
  // Combat Stat Calculations
  // =====================================

  attackWithWeapon(weapon, accessory = this.accessory()) {
    const weaponAttack = weapon ? weapon.attack || 0 : 0;

    return (
      this.attack +
      this.strength +
      weaponAttack +
      this.accessoryBonus("attack", accessory)
    );
  }

  totalAttack() {
    return this.attackWithWeapon(this.weapon(), this.accessory());
  }

  attackPercentWithWeapon(weapon) {
    const weaponAttackPercent = weapon ? (weapon.attackPercent ?? 100) : 100;

    return (this.attackPercent * weaponAttackPercent) / 100;
  }

  totalAttackPercent() {
    return this.attackPercentWithWeapon(this.weapon());
  }

  defenseWithArmor(armor, accessory = this.accessory()) {
    const armorDefense = armor ? armor.defense || 0 : 0;

    return (
      this.defense +
      this.vitality +
      armorDefense +
      this.accessoryBonus("defense", accessory)
    );
  }

  totalDefense() {
    return this.defenseWithArmor(this.armor(), this.accessory());
  }

  // =====================================
  // Magic Attack Calculations
  // =====================================

  magicAttackWithWeapon(weapon, accessory = this.accessory()) {
    const weaponMagicAttack = weapon ? weapon.magicAttack || 0 : 0;

    return (
      this.magicAttack +
      this.magic +
      weaponMagicAttack +
      this.accessoryBonus("magicAttack", accessory)
    );
  }

  totalMagicAttack() {
    return this.magicAttackWithWeapon(this.weapon(), this.accessory());
  }

  magicDefenseWithAccessory(accessory) {
    return (
      super.totalMagicDefense() +
      this.accessoryBonus("magicDefense", accessory)
    );
  }

  totalMagicDefense() {
    return this.magicDefenseWithAccessory(this.accessory());
  }

  criticalWithWeapon(weapon, accessory = this.accessory()) {
    const weaponCritical = weapon ? weapon.criticalBonus || 0 : 0;

    return weaponCritical + this.accessoryBonus("criticalBonus", accessory);
  }

  totalCritical() {
    return this.criticalWithWeapon(this.weapon(), this.accessory());
  }
}
