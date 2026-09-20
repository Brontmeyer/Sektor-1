"use strict";

class BattleFormationManager {
  static NORMAL = "normal";
  static BACK_ATTACK = "backAttack";
  static PINCER = "pincer";
  static REAR_PHYSICAL_DAMAGE_MULTIPLIER = 1.5;
  static MAX_ENEMIES = 5;

  constructor(scene) {
    this.scene = scene;
  }

  formation() {
    return this.scene.encounter?.formation || BattleFormationManager.NORMAL;
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

  verticalPartyPositions(count = this.partyMembers().length) {
    const safeCount = Math.max(1, Number(count) || 1);
    const top = this.battlefieldTop();
    const bottom = this.battlefieldBottom();
    const span = bottom - top;
    const step = span / safeCount;

    return Array.from({ length: safeCount }, (_, index) => ({
      x: 0,
      y: top + step * (index + 0.9),
    }));
  }

  partyX() {
    if (this.is(BattleFormationManager.PINCER)) {
      return Graphics.width * 0.5;
    }

    // Normal and Back Attack both keep the party on the left. Back Attack is
    // expressed through facing/exposure rather than teleporting sides.
    return Graphics.width * 0.17;
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

  positionForActor(actor) {
    const index = $gameParty.battleMemberIndex(actor);
    return this.partyPosition(index < 0 ? 0 : index);
  }

  memberSide(index) {
    const member = this.scene.encounter?.members?.[index];

    if (this.is(BattleFormationManager.PINCER)) {
      return member?.side === "left" ? "left" : "right";
    }

    return "right";
  }

  enemyX(index) {
    return this.memberSide(index) === "left"
      ? Graphics.width * 0.14
      : Graphics.width * 0.84;
  }

  enemySlotY(slot) {
    const top = this.battlefieldTop();
    const bottom = this.battlefieldBottom();
    const span = bottom - top;
    const fractions = [0.18, 0.34, 0.5, 0.66, 0.82];
    const safeSlot = Math.max(
      0,
      Math.min(Number(slot) || 0, fractions.length - 1),
    );

    return top + span * fractions[safeSlot];
  }

  enemyPosition(index) {
    const member = this.scene.encounter?.members?.[index] || {};

    return {
      x: this.enemyX(index),
      y: this.enemySlotY(member.slot),
    };
  }

  partyScale() {
    const members = this.partyMembers();

    if (members.length === 0) {
      return 1;
    }

    const tallest = Math.max(
      ...members.map((actor) =>
        Math.max(1, Number(actor?.battleSpriteHeight) || 1),
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

    const sameSideCount = this.scene.enemies.filter(
      (_candidate, candidateIndex) =>
        this.memberSide(candidateIndex) === this.memberSide(index),
    ).length;
    const availableHeight = this.battlefieldBottom() - this.battlefieldTop();
    const laneHeight =
      availableHeight /
      Math.max(1, Math.min(BattleFormationManager.MAX_ENEMIES, sameSideCount));
    const height = Math.max(1, Number(enemy.battleSpriteHeight) || 1);
    const width = Math.max(1, Number(enemy.battleSpriteWidth) || 1);
    const heightScale = (laneHeight * 0.92) / height;
    const widthScale = (Graphics.width * 0.18) / width;

    return Math.max(0.45, Math.min(1, heightScale, widthScale));
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
    const targetPosition = this.positionForActor(target);
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
