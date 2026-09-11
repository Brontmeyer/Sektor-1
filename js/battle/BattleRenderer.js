"use strict";

class BattleRenderer {
  constructor(scene) {
    this.scene = scene;
  }

  drawActorSprite(context, x, y, actor = $gameActor) {
    const width = actor.battleSpriteWidth;
    const height = actor.battleSpriteHeight;

    const scale = this.scene.getActorVisualScale();
    const alpha = this.scene.getActorVisualAlpha();

    const battleData = this.scene.getPartyBattleData(actor);
    const image = this.scene.getPartyBattleImage(actor);

    context.save();

    context.globalAlpha = alpha;

    context.translate(x, y - height / 2);

    context.scale(scale, scale);

    if (image && image.complete && image.naturalWidth > 0) {
      const state = battleData?.state || "idle";
      const animation = this.scene.getBattlerAnimationData(state);

      const frameCount = actor.battleSpriteFrames || 1;
      const rowCount = actor.battleSpriteRows || 1;

      const sourceFrameWidth = image.naturalWidth / frameCount;
      const sourceFrameHeight = image.naturalHeight / rowCount;

      const frame = Math.min(battleData?.animationFrame || 0, frameCount - 1);

      const sourceX = frame * sourceFrameWidth;

      const requestedRow = this.scene.getBattlerAnimationRow(state);

      const row = Math.min(requestedRow, rowCount - 1);

      const sourceY = row * sourceFrameHeight;

      context.drawImage(
        image,

        sourceX,
        sourceY,
        sourceFrameWidth,
        sourceFrameHeight,

        -width / 2,
        -height / 2,
        width,
        height,
      );

      context.restore();
      return;
    }

    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;

    context.strokeRect(-width / 2, -height / 2, width, height);

    context.restore();
  }

  drawEnemySprite(context, x, y, enemy, battleData) {
    if (!enemy || !battleData) {
      return;
    }

    const width = enemy.battleSpriteWidth;
    const height = enemy.battleSpriteHeight;
    const alpha = this.scene.getEnemyVisualAlpha(enemy);
    const image = enemy.battleSprite
      ? this.scene.enemyImages.get(enemy.battleSprite)
      : null;

    context.save();
    context.globalAlpha = alpha;
    context.translate(x, y - height / 2);

    if (image && image.complete && image.naturalWidth > 0) {
      const frameCount = enemy.battleSpriteFrames || 1;
      const rowCount = enemy.battleSpriteRows || 1;

      const sourceFrameWidth = image.naturalWidth / frameCount;
      const sourceFrameHeight = image.naturalHeight / rowCount;

      const frame = Math.min(battleData.animationFrame, frameCount - 1);
      const sourceX = frame * sourceFrameWidth;

      const requestedRow = this.scene.getBattlerAnimationRow(battleData.state);
      const row = Math.min(requestedRow, rowCount - 1);
      const sourceY = row * sourceFrameHeight;

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceFrameWidth,
        sourceFrameHeight,
        -width / 2,
        -height / 2,
        width,
        height,
      );

      context.restore();
      return;
    }

    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.strokeRect(-width / 2, -height / 2, width, height);
    context.restore();
  }

  drawEnemies(context) {
    for (let i = 0; i < this.scene.enemies.length; i++) {
      const enemy = this.scene.enemies[i];
      const battleData = this.scene.enemyBattleData[i];

      if (!enemy || !battleData) {
        continue;
      }

      const position = this.scene.getEnemyBattlePosition(i);

      this.drawEnemySprite(
        context,
        position.x + battleData.visualX,
        position.y,
        enemy,
        battleData,
      );
    }
  }

  drawEnemyTargetCursor(context) {
    if (!this.scene.selectingEnemyTarget) {
      return;
    }

    context.save();

    context.font = "32px sans-serif";
    context.textAlign = "center";

    // -----------------------------
    // ALL TARGETS
    // -----------------------------

    if (this.scene.targetScope === "all") {
      if (this.scene.targetGroup === "ally") {
        const allies = $gameParty.livingBattleMembers();

        for (const ally of allies) {
          const position = this.scene.getAllyPosition(ally);
          context.fillText("▼", position.x, position.y - 160);
        }
      } else {
        for (let i = 0; i < this.scene.enemies.length; i++) {
          const enemy = this.scene.enemies[i];

          if (!enemy || enemy.isDead()) {
            continue;
          }

          const position = this.scene.getEnemyBattlePosition(i);

          context.fillText("▼", position.x, position.y - 110);
        }
      }

      context.restore();
      return;
    }

    // -----------------------------
    // SINGLE TARGET
    // -----------------------------

    let x;
    let y;

    if (this.scene.targetGroup === "ally") {
      const position = this.scene.getAllyBattlePosition(
        this.scene.selectedAllyIndex,
      );

      x = position.x;
      y = position.y - 160;
    } else {
      const position = this.scene.getEnemyBattlePosition(
        this.scene.selectedEnemyIndex,
      );

      x = position.x;
      y = position.y - 110;
    }

    context.fillText("▼", x, y);

    context.restore();
  }

  drawFrontView(context) {
    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    context.font = "34px Arial";
    context.fillStyle = "#ffffff";

    context.fillText(this.scene.enemy.name, Graphics.width / 2, 180);

    context.font = "22px Arial";

    context.fillText(
      `HP: ${this.scene.enemy.hp} / ${this.scene.enemy.maxHp}`,
      Graphics.width / 2,
      220,
    );

    this.drawEnemySprite(
      context,
      Graphics.width / 2,
      355,
      this.scene.enemy,
      this.scene.getEnemyBattleData(this.scene.enemy),
    );
  }

  drawSideView(context) {
    const partyMembers = this.scene.getBattlePartyMembers();

    // -----------------------------
    // Party battlefield positions
    // -----------------------------

    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    context.font = "24px Arial";
    context.fillStyle = "#ffffff";

    partyMembers.forEach((actor, index) => {
      const position = this.scene.getAllyBattlePosition(index);
      const battleData = this.scene.getPartyBattleData(actor);

      const visualX = battleData?.visualX || 0;
      const visualY = battleData?.visualY || 0;

      this.drawActorSprite(
        context,
        position.x + visualX,
        position.y + visualY + this.scene.getActorStateYOffset(),
        actor,
      );
    });

    context.font = "16px Arial";
    context.fillStyle = "#ffffff";

    this.drawEnemies(context);
    this.drawEnemyTargetCursor(context);
  }

  drawBattleHud(context) {
    const hudHeight = 180;
    const hudY = Graphics.height - hudHeight - 10;

    context.fillStyle = "rgba(0, 0, 0, 0.9)";

    context.fillRect(20, hudY, Graphics.width - 40, hudHeight);

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;

    context.strokeRect(20, hudY, Graphics.width - 40, hudHeight);

    // Party status. With one member this preserves the current layout; with
    // two or three members it automatically spreads the status blocks out.
    const members = $gameParty.battleMembers();

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";

    if (members.length <= 1) {
      const actor = members[0] || $gameActor;
      const statusX = Graphics.width - 320;

      context.font = "22px Arial";
      context.fillText(actor.name, statusX, hudY + 45);

      context.font = "18px Arial";
      context.fillText(`HP: ${actor.hp} / ${actor.maxHp}`, statusX, hudY + 85);
      context.fillText(`MP: ${actor.mp} / ${actor.maxMp}`, statusX, hudY + 120);
      return;
    }

    const statusStartX = Math.max(300, Graphics.width - 690);
    const statusWidth = (Graphics.width - statusStartX - 40) / members.length;

    members.forEach((actor, index) => {
      const statusX = statusStartX + index * statusWidth;

      context.font = "20px Arial";
      context.fillText(actor.name, statusX, hudY + 42);

      context.font = "16px Arial";
      context.fillText(`HP: ${actor.hp} / ${actor.maxHp}`, statusX, hudY + 82);
      context.fillText(`MP: ${actor.mp} / ${actor.maxMp}`, statusX, hudY + 116);
    });
  }

  drawBattleEffect(context) {
    this.scene.battleEffects.draw(context);
  }

  draw() {
    const context = Graphics.context;

    context.save();

    // -----------------------------
    // Battle background
    // -----------------------------

    context.fillStyle = "#202020";

    context.fillRect(0, 0, Graphics.width, Graphics.height);

    // -----------------------------
    // Battle title
    // -----------------------------

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.font = "28px Arial";
    context.fillStyle = "#ffffff";

    context.fillText("Battle", 40, 50);

    // -----------------------------
    // Battle presentation
    // -----------------------------

    if (this.scene.battleView === "front") {
      this.drawFrontView(context);
    } else {
      this.drawSideView(context);
    }
    this.drawBattleHud(context);
    this.drawBattleEffect(context);

    // -----------------------------
    // Battle messages
    // -----------------------------

    if (this.scene.battleMessages.length > 0) {
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.font = "20px Arial";
      context.fillStyle = "#ffffff";

      const startY = Graphics.height - 250;

      for (let i = 0; i < this.scene.battleMessages.length; i++) {
        context.fillText(
          this.scene.battleMessages[i],
          Graphics.width / 2,
          startY + i * 28,
        );
      }
    }

    // -----------------------------
    // Test battle exit hint
    // -----------------------------

    context.textAlign = "right";
    context.textBaseline = "alphabetic";
    context.font = "16px Arial";
    context.fillStyle = "#ffffff";

    context.fillText(
      "Escape: Leave Test Battle",
      Graphics.width - 30,
      Graphics.height - 30,
    );

    // -----------------------------
    // Battle windows
    // -----------------------------

    if (
      !this.scene.victory &&
      !this.scene.defeat &&
      !this.scene.battleInputLocked &&
      !this.scene.magicWindow.isOpen() &&
      !this.scene.itemWindow.isOpen()
    ) {
      this.scene.commandWindow.draw();
    }

    this.scene.magicWindow.draw();
    this.scene.itemWindow.draw();

    context.restore();
  }
}
