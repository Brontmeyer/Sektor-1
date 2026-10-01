"use strict";

class BattleFormationManager {
  static NORMAL = "normal";
  static BACK_ATTACK = "backAttack";
  static PINCER = "pincer";
  static FRONT_ROW = "front";
  static BACK_ROW = "back";
  static REAR_PHYSICAL_DAMAGE_MULTIPLIER = 1.5;
  static MAX_ENEMIES = 6;
  static ROW_SLOT_COUNT = 3;
  static PARTY_BACK_ROW_OFFSET = 0.04;
  static PINCER_FRONT_ROW_OFFSET = 0.035;
  static PARTY_VERTICAL_OFFSET = 0.145;
  static ENEMY_VERTICAL_OFFSET = 0.145;

  // Encounter topology (normal/back attack/pincer) answers which side battlers
  // occupy. A layout profile answers how an enemy group uses the available
  // battlefield space. Keeping those concepts separate lets bosses, hordes,
  // elites, and future summoned adds share the same targeting mechanics.
  static LAYOUT_STANDARD = "standard";
  static LAYOUT_HORDE = "horde";
  static LAYOUT_SOLO_BOSS = "soloBoss";
  static LAYOUT_BOSS_ADDS = "bossAdds";
  static LAYOUT_ELITE_GROUP = "eliteGroup";
  static LAYOUT_PROFILES = Object.freeze({
    standard: Object.freeze({
      rowX: Object.freeze({
        left: Object.freeze({ front: 0.22, back: 0.13 }),
        right: Object.freeze({ front: 0.78, back: 0.87 }),
      }),
      slotFractions: Object.freeze([0.22, 0.5, 0.78]),
      automaticFractions: Object.freeze({
        1: Object.freeze([0.5]),
        2: Object.freeze([0.38, 0.62]),
        3: Object.freeze([0.22, 0.5, 0.78]),
      }),
      laneFill: 0.92,
      widthRatio: 0.14,
      minScale: 0.45,
      maxScale: 1,
      roleAnchors: Object.freeze({}),
    }),
    horde: Object.freeze({
      rowX: Object.freeze({
        left: Object.freeze({ front: 0.22, back: 0.13 }),
        right: Object.freeze({ front: 0.78, back: 0.87 }),
      }),
      slotFractions: Object.freeze([0.22, 0.5, 0.78]),
      automaticFractions: Object.freeze({
        1: Object.freeze([0.5]),
        2: Object.freeze([0.38, 0.62]),
        3: Object.freeze([0.22, 0.5, 0.78]),
      }),
      laneFill: 0.92,
      widthRatio: 0.14,
      minScale: 0.45,
      maxScale: 1,
      roleAnchors: Object.freeze({}),
    }),
    soloBoss: Object.freeze({
      rowX: Object.freeze({
        left: Object.freeze({ front: 0.24, back: 0.16 }),
        right: Object.freeze({ front: 0.76, back: 0.84 }),
      }),
      slotFractions: Object.freeze([0.22, 0.5, 0.78]),
      automaticFractions: Object.freeze({
        1: Object.freeze([0.5]),
        2: Object.freeze([0.36, 0.64]),
        3: Object.freeze([0.2, 0.5, 0.8]),
      }),
      laneFill: 0.96,
      widthRatio: 0.28,
      minScale: 0.45,
      maxScale: 1.18,
      roleAnchors: Object.freeze({
        boss: Object.freeze({ x: 0.76, y: 0.5 }),
      }),
    }),
    bossAdds: Object.freeze({
      rowX: Object.freeze({
        left: Object.freeze({ front: 0.24, back: 0.13 }),
        right: Object.freeze({ front: 0.76, back: 0.87 }),
      }),
      slotFractions: Object.freeze([0.18, 0.5, 0.82]),
      automaticFractions: Object.freeze({
        1: Object.freeze([0.5]),
        2: Object.freeze([0.3, 0.7]),
        3: Object.freeze([0.18, 0.5, 0.82]),
      }),
      laneFill: 0.9,
      widthRatio: 0.22,
      minScale: 0.45,
      maxScale: 1.08,
      roleAnchors: Object.freeze({
        boss: Object.freeze({ x: 0.82, y: 0.5 }),
      }),
    }),
    eliteGroup: Object.freeze({
      rowX: Object.freeze({
        left: Object.freeze({ front: 0.22, back: 0.12 }),
        right: Object.freeze({ front: 0.78, back: 0.88 }),
      }),
      slotFractions: Object.freeze([0.18, 0.5, 0.82]),
      automaticFractions: Object.freeze({
        1: Object.freeze([0.5]),
        2: Object.freeze([0.32, 0.68]),
        3: Object.freeze([0.18, 0.5, 0.82]),
      }),
      laneFill: 0.94,
      widthRatio: 0.2,
      minScale: 0.45,
      maxScale: 1.08,
      roleAnchors: Object.freeze({}),
    }),
  });

  constructor(scene) {
    this.scene = scene;
  }

  formation() {
    return this.scene.encounter?.formation || BattleFormationManager.NORMAL;
  }

  layoutProfileName() {
    const requested = String(
      this.scene.encounter?.layoutProfile || BattleFormationManager.LAYOUT_STANDARD,
    );

    return BattleFormationManager.LAYOUT_PROFILES[requested]
      ? requested
      : BattleFormationManager.LAYOUT_STANDARD;
  }

  layoutProfile() {
    return BattleFormationManager.LAYOUT_PROFILES[this.layoutProfileName()];
  }

  is(type) {
    return this.formation() === type;
  }

  battlefieldTop() {
    return Math.max(52, Graphics.height * 0.075);
  }

  battlefieldBottom() {
    const hudTop = this.scene.hudLayout?.hudBounds?.().y;

    if (Number.isFinite(hudTop)) {
      return Math.max(this.battlefieldTop() + 220, hudTop - 18);
    }

    return Math.max(this.battlefieldTop() + 220, Graphics.height - 205);
  }

  partyMembers() {
    return $gameParty.battleMembers();
  }

  groundedVerticalPositions(fractions, offsetRatio) {
    const safeFractions = Array.isArray(fractions) && fractions.length > 0
      ? fractions
      : [0.5];
    const top = this.battlefieldTop();
    const bottom = this.battlefieldBottom();
    const span = bottom - top;
    const bottomLimit = bottom - 8;
    const offset = Graphics.height * (Number(offsetRatio) || 0);
    const raw = safeFractions.map(
      (fraction) => top + span * fraction + offset,
    );

    if (raw.length === 1) {
      return [Math.min(bottomLimit, raw[0])];
    }

    const first = raw[0];
    const last = raw[raw.length - 1];

    if (last <= bottomLimit || last <= first) {
      return raw.map((value) => Math.min(bottomLimit, value));
    }

    // Keep the upper lane where the composition already reads well, then
    // compress the full formation uniformly into the available ground band.
    // Clamping only the final battler made the lower pair visibly closer.
    const compressedSpan = Math.max(0, bottomLimit - first);
    const rawSpan = last - first;

    return raw.map(
      (value) => first + ((value - first) / rawSpan) * compressedSpan,
    );
  }

  verticalPartyPositions(count = this.partyMembers().length) {
    const safeCount = Math.max(
      1,
      Math.min($gameParty?.constructor?.MAX_BATTLE_MEMBERS || 3, Number(count) || 1),
    );
    const layouts = {
      1: [0.5],
      2: [0.34, 0.66],
      3: [0.2, 0.5, 0.8],
    };
    const fractions = layouts[safeCount] || layouts[3];
    const verticalPositions = this.groundedVerticalPositions(
      fractions,
      BattleFormationManager.PARTY_VERTICAL_OFFSET,
    );

    return verticalPositions.map((y) => ({ x: 0, y }));
  }

  partyX() {
    if (this.is(BattleFormationManager.PINCER)) {
      return Graphics.width * 0.5;
    }

    // Normal and Back Attack both keep the party on the left. Back Attack is
    // expressed through facing/exposure rather than teleporting sides.
    return Graphics.width * 0.17;
  }

  partyRow(actor) {
    return $gameParty.battleRow?.(actor) === BattleFormationManager.BACK_ROW
      ? BattleFormationManager.BACK_ROW
      : BattleFormationManager.FRONT_ROW;
  }

  pincerPartyDirection(actor) {
    const battleIndex = Math.max(0, $gameParty.battleMemberIndex(actor));
    return battleIndex % 2 === 0 ? -1 : 1;
  }

  partyVisualX(actor) {
    const row = this.partyRow(actor);

    if (this.is(BattleFormationManager.PINCER)) {
      // Pincer actors keep a stable side based on mechanical active-party
      // order. Front-row actors step outward toward that flank; back-row
      // actors remain sheltered at the party center. Target selection never
      // changes this side, so moving the cursor cannot move a battler.
      if (row === BattleFormationManager.BACK_ROW) {
        return this.partyX();
      }

      return (
        this.partyX() +
        Graphics.width *
          BattleFormationManager.PINCER_FRONT_ROW_OFFSET *
          this.pincerPartyDirection(actor)
      );
    }

    // Front is the established party line. Back row moves away from the
    // enemy side, preserving existing front-row placement for old/default
    // saves while making the chosen row visible on the battlefield.
    return row === BattleFormationManager.BACK_ROW
      ? this.partyX() - Graphics.width * BattleFormationManager.PARTY_BACK_ROW_OFFSET
      : this.partyX();
  }

  partyPosition(index) {
    const positions = this.verticalPartyPositions();
    const safeIndex = Math.max(
      0,
      Math.min(Number(index) || 0, positions.length - 1),
    );
    const position = positions[safeIndex] || positions[0];

    return {
      x: this.partyX(),
      y: position.y,
    };
  }

  targetPositionForActor(actor) {
    const formationIndex =
      $gameParty.battleFormationIndex?.(actor) ??
      $gameParty.battleMemberIndex(actor);
    return this.partyPosition(formationIndex < 0 ? 0 : formationIndex);
  }

  positionForActor(actor) {
    const position = this.targetPositionForActor(actor);

    return {
      x: this.partyVisualX(actor),
      y: position.y,
    };
  }

  encounterMember(index) {
    return this.scene.encounter?.members?.[index] || {};
  }

  memberSide(index) {
    const member = this.encounterMember(index);

    if (this.is(BattleFormationManager.PINCER)) {
      return member.side === "left" ? "left" : "right";
    }

    return "right";
  }

  memberRow(index) {
    return this.encounterMember(index).row === BattleFormationManager.BACK_ROW
      ? BattleFormationManager.BACK_ROW
      : BattleFormationManager.FRONT_ROW;
  }

  rowMemberIndexes(index) {
    const side = this.memberSide(index);
    const row = this.memberRow(index);
    const members = this.scene.encounter?.members || [];

    return members
      .map((_member, candidateIndex) => candidateIndex)
      .filter(
        (candidateIndex) =>
          this.memberSide(candidateIndex) === side &&
          this.memberRow(candidateIndex) === row,
      );
  }

  rowX(side, row) {
    const profile = this.layoutProfile();
    const sideRows = profile.rowX?.[side] || profile.rowX?.right || {};
    const fraction = row === BattleFormationManager.BACK_ROW
      ? sideRows.back
      : sideRows.front;

    return Graphics.width * (Number(fraction) || 0.5);
  }

  fixedSlotFractions() {
    const fractions = this.layoutProfile().slotFractions;
    return Array.isArray(fractions) && fractions.length > 0
      ? [...fractions]
      : [0.22, 0.5, 0.78];
  }

  automaticRowFractions(count) {
    const safeCount = Math.max(
      1,
      Math.min(BattleFormationManager.ROW_SLOT_COUNT, Number(count) || 1),
    );
    const layouts = this.layoutProfile().automaticFractions || {};
    const fractions = layouts[safeCount];

    return Array.isArray(fractions) && fractions.length > 0
      ? [...fractions]
      : this.fixedSlotFractions().slice(0, safeCount);
  }

  automaticSlotIndexes(count) {
    const safeCount = Math.max(
      1,
      Math.min(BattleFormationManager.ROW_SLOT_COUNT, Number(count) || 1),
    );
    const layouts = {
      1: [1],
      2: [0, 2],
      3: [0, 1, 2],
    };

    return [...layouts[safeCount]];
  }

  memberRole(index) {
    const role = this.encounterMember(index).role;
    return typeof role === "string" ? role : null;
  }

  roleAnchor(index) {
    const role = this.memberRole(index);
    const anchor = role ? this.layoutProfile().roleAnchors?.[role] : null;

    if (!anchor) {
      return null;
    }

    const side = this.memberSide(index);
    const rightX = Number(anchor.x);
    const xFraction = Number.isFinite(rightX)
      ? (side === "left" ? 1 - rightX : rightX)
      : 0.5;
    const yFraction = Number.isFinite(Number(anchor.y)) ? Number(anchor.y) : 0.5;

    return { xFraction, yFraction };
  }

  memberSlotIndex(index) {
    const member = this.encounterMember(index);

    if (Number.isInteger(member.slot)) {
      return Math.max(0, Math.min(member.slot, BattleFormationManager.ROW_SLOT_COUNT - 1));
    }

    if (this.roleAnchor(index)) {
      return null;
    }

    const groupIndexes = this.rowMemberIndexes(index).filter(
      (candidateIndex) =>
        !Number.isInteger(this.encounterMember(candidateIndex).slot) &&
        !this.roleAnchor(candidateIndex),
    );
    const position = groupIndexes.indexOf(index);
    const slots = this.automaticSlotIndexes(groupIndexes.length);

    return position >= 0 ? slots[Math.min(position, slots.length - 1)] : null;
  }

  occupiedEnemySlots(side = "right", row = BattleFormationManager.FRONT_ROW) {
    const members = this.scene.encounter?.members || [];
    const occupied = new Set();

    members.forEach((_member, index) => {
      if (this.memberSide(index) !== side || this.memberRow(index) !== row) {
        return;
      }

      const slot = this.memberSlotIndex(index);
      if (Number.isInteger(slot)) {
        occupied.add(slot);
      }
    });

    return occupied;
  }

  availableEnemySlots(side = "right", row = BattleFormationManager.FRONT_ROW) {
    const occupied = this.occupiedEnemySlots(side, row);
    return [0, 1, 2].filter((slot) => !occupied.has(slot));
  }

  nextOpenEnemySlot(side = "right", row = BattleFormationManager.FRONT_ROW) {
    const available = new Set(this.availableEnemySlots(side, row));
    return [1, 0, 2].find((slot) => available.has(slot)) ?? null;
  }

  positionForEnemySlot(side, row, slot) {
    const fractions = this.fixedSlotFractions();
    const safeSlot = Math.max(0, Math.min(Number(slot) || 0, fractions.length - 1));
    const y = this.groundedVerticalPositions(
      fractions,
      BattleFormationManager.ENEMY_VERTICAL_OFFSET,
    )[safeSlot];

    return { x: this.rowX(side, row), y };
  }

  enemyY(index) {
    const member = this.encounterMember(index);
    const anchor = this.roleAnchor(index);

    if (anchor) {
      return this.groundedVerticalPositions(
        [anchor.yFraction],
        BattleFormationManager.ENEMY_VERTICAL_OFFSET,
      )[0];
    }

    const groupIndexes = this.rowMemberIndexes(index);

    if (Number.isInteger(member.slot)) {
      const fractions = this.fixedSlotFractions();
      const slot = Math.max(0, Math.min(member.slot, fractions.length - 1));
      return this.groundedVerticalPositions(
        fractions,
        BattleFormationManager.ENEMY_VERTICAL_OFFSET,
      )[slot];
    }

    const automaticIndexes = groupIndexes.filter(
      (candidateIndex) =>
        !Number.isInteger(this.encounterMember(candidateIndex).slot) &&
        !this.roleAnchor(candidateIndex),
    );
    const autoIndex = Math.max(0, automaticIndexes.indexOf(index));
    const fractions = this.automaticRowFractions(automaticIndexes.length);
    const positions = this.groundedVerticalPositions(
      fractions,
      BattleFormationManager.ENEMY_VERTICAL_OFFSET,
    );

    return positions[Math.min(autoIndex, positions.length - 1)];
  }

  battlerVisualScale(battler) {
    if (typeof battler?.battleVisualScale === "function") {
      return battler.battleVisualScale();
    }

    const scale = Number(battler?.battleVisual?.scale);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  enemyFootprintWidth(enemy) {
    return Math.max(
      1,
      Number(enemy?.battleFootprintWidth) ||
        Number(enemy?.battleSpriteWidth) ||
        1,
    );
  }

  clampEnemyX(rawX, enemy, index) {
    if (!enemy) {
      return rawX;
    }

    const scale =
      this.enemyScale(enemy, index) * this.battlerVisualScale(enemy);
    const halfWidth = this.enemyFootprintWidth(enemy) * scale * 0.5;
    const edgePadding = 18;
    const minimum = edgePadding + halfWidth;
    const maximum = Graphics.width - edgePadding - halfWidth;

    if (maximum <= minimum) {
      return Graphics.width * 0.5;
    }

    return Math.max(minimum, Math.min(maximum, rawX));
  }

  enemyX(index) {
    const side = this.memberSide(index);
    const row = this.memberRow(index);
    const anchor = this.roleAnchor(index);
    const rawX = anchor
      ? Graphics.width * anchor.xFraction
      : this.rowX(side, row);
    const enemy = this.scene.enemies?.[index] || null;

    return this.clampEnemyX(rawX, enemy, index);
  }

  enemyPosition(index) {
    return {
      x: this.enemyX(index),
      y: this.enemyY(index),
    };
  }

  partyScale() {
    const members = this.partyMembers();

    if (members.length === 0) {
      return 1;
    }

    const tallest = Math.max(
      ...members.map((actor) =>
        Math.max(
          1,
          (Number(actor?.battleSpriteHeight) || 1) *
            this.battlerVisualScale(actor),
        ),
      ),
    );
    const availableHeight = this.battlefieldBottom() - this.battlefieldTop();
    const laneHeight = availableHeight / members.length;
    const maxSpriteHeight = laneHeight * 0.96;

    return Math.max(0.4, Math.min(1.08, maxSpriteHeight / tallest));
  }

  enemyScale(enemy, index = this.scene.enemies.indexOf(enemy)) {
    if (!enemy) {
      return 1;
    }

    const profile = this.layoutProfile();
    const anchored = Boolean(this.roleAnchor(index));
    const rowCount = anchored ? 1 : this.rowMemberIndexes(index).filter(
      (candidateIndex) => !this.roleAnchor(candidateIndex),
    ).length;
    const availableHeight = this.battlefieldBottom() - this.battlefieldTop();
    const laneHeight =
      availableHeight /
      Math.max(1, Math.min(BattleFormationManager.ROW_SLOT_COUNT, rowCount));
    const visualScale = this.battlerVisualScale(enemy);
    const height =
      Math.max(1, Number(enemy.battleSpriteHeight) || 1) * visualScale;
    const width = this.enemyFootprintWidth(enemy) * visualScale;
    const laneFill = Number(profile.laneFill) || 0.92;
    const widthRatio = Number(profile.widthRatio) || 0.14;
    const minScale = Number(profile.minScale) || 0.45;
    const maxScale = Number(profile.maxScale) || 1;
    const heightScale = (laneHeight * laneFill) / height;
    const widthScale = (Graphics.width * widthRatio) / width;

    return Math.max(minScale, Math.min(maxScale, heightScale, widthScale));
  }

  actorFacing(actor) {
    if (this.is(BattleFormationManager.BACK_ATTACK)) {
      const isActive = this.scene.partyController?.currentBattler?.() === actor;
      const temporarilyFacingEnemy =
        isActive &&
        (this.scene.selectingEnemyTarget ||
          (this.scene.actionPhase && this.scene.actionPhase !== "none"));

      return this.scene.hasActorTurnedInBackAttack?.(actor) || temporarilyFacingEnemy
        ? 1
        : -1;
    }

    if (this.is(BattleFormationManager.PINCER)) {
      const isActive = this.scene.partyController?.currentBattler?.() === actor;
      const target = isActive
        ? this.scene.pendingAttackTarget ||
          (this.scene.selectingEnemyTarget
            ? this.scene.targetManager?.getSelectedTarget?.()
            : null)
        : null;

      if (target && this.scene.enemies.includes(target)) {
        const actorPosition = this.positionForActor(actor);
        const targetPosition = this.enemyPosition(
          this.scene.enemies.indexOf(target),
        );
        return targetPosition.x < actorPosition.x ? -1 : 1;
      }

      const index = Math.max(0, $gameParty.battleMemberIndex(actor));
      return index % 2 === 0 ? -1 : 1;
    }

    return 1;
  }

  enemyFacing(enemy) {
    const index = this.scene.enemies.indexOf(enemy);

    // Enemy source sprites retain their existing right-side orientation. Only
    // enemies explicitly placed on a pincer left flank are mirrored.
    return this.memberSide(index) === "left" ? -1 : 1;
  }

  actorAdvanceDirection(actor) {
    return this.actorFacing(actor);
  }

  enemyAdvanceDirection(enemy) {
    const index = this.scene.enemies.indexOf(enemy);
    return this.memberSide(index) === "left" ? 1 : -1;
  }

  isPartyRearExposed(attacker, target) {
    if (
      !attacker ||
      !target ||
      !this.scene.enemies.includes(attacker) ||
      !$gameParty.battleMembers().includes(target)
    ) {
      return false;
    }

    const attackerPosition = this.enemyPosition(this.scene.enemies.indexOf(attacker));
    // Row is presentation-only. Rear exposure intentionally uses the
    // row-neutral combat/targeting position rather than the visual offset.
    const targetPosition = this.targetPositionForActor(target);
    const directionToAttacker = Math.sign(attackerPosition.x - targetPosition.x);

    if (directionToAttacker === 0) {
      return false;
    }

    return this.actorFacing(target) !== directionToAttacker;
  }

  physicalRearDamageMultiplier(attacker, target) {
    return this.isPartyRearExposed(attacker, target)
      ? BattleFormationManager.REAR_PHYSICAL_DAMAGE_MULTIPLIER
      : 1;
  }
}
