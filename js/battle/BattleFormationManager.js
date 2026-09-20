"use strict";

class BattleFormationManager {
  static NORMAL = "normal";
  static BACK_ATTACK = "backAttack";
  static PINCER = "pincer";

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
    return Math.max(72, Graphics.height * 0.1);
  }

  battlefieldBottom() {
    return Math.max(this.battlefieldTop() + 220, Graphics.height - 215);
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
      y: top + step * (index + 0.88),
    }));
  }

  partyX() {
    if (this.is(BattleFormationManager.BACK_ATTACK)) {
      return Graphics.width * 0.78;
    }

    if (this.is(BattleFormationManager.PINCER)) {
      return Graphics.width * 0.5;
    }

    return Graphics.width * 0.22;
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

    return this.is(BattleFormationManager.BACK_ATTACK) ? "left" : "right";
  }

  enemyX(index) {
    return this.memberSide(index) === "left"
      ? Graphics.width * 0.16
      : Graphics.width * 0.84;
  }

  enemySlotY(slot) {
    const top = this.battlefieldTop();
    const bottom = this.battlefieldBottom();
    const span = bottom - top;
    const fractions = [0.58, 0.4, 0.24];
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
    const maxSpriteHeight = laneHeight * 0.84;

    return Math.max(0.35, Math.min(1, maxSpriteHeight / tallest));
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
    const laneHeight = availableHeight / Math.max(1, Math.min(3, sameSideCount));
    const height = Math.max(1, Number(enemy.battleSpriteHeight) || 1);
    const width = Math.max(1, Number(enemy.battleSpriteWidth) || 1);
    const heightScale = (laneHeight * 0.82) / height;
    const widthScale = (Graphics.width * 0.2) / width;

    return Math.max(0.5, Math.min(1, heightScale, widthScale));
  }

  actorFacing(actor) {
    if (this.is(BattleFormationManager.BACK_ATTACK)) {
      return -1;
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

    // Enemy source sprites retain their existing normal-battle orientation on
    // the right side. Only enemies placed on the left flank are mirrored.
    return this.memberSide(index) === "left" ? -1 : 1;
  }

  actorAdvanceDirection(actor) {
    return this.actorFacing(actor);
  }

  enemyAdvanceDirection(enemy) {
    const index = this.scene.enemies.indexOf(enemy);
    return this.memberSide(index) === "left" ? 1 : -1;
  }
}
