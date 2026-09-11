"use strict";

class BattleEffects {
  constructor(scene) {
    this.scene = scene;
    this.current = null;
  }

  update(deltaTime) {
    if (!this.current) {
      return;
    }

    this.current.timer -= deltaTime;

    if (this.current.timer <= 0) {
      this.current = null;
    }
  }

  start(type, target, duration = 0.4) {
    this.current = {
      type,
      target,
      timer: duration,
      duration,
    };
  }

  draw(context) {
    if (!this.current) {
      return;
    }

    const effect = this.current;

    if (effect.type === "fire") {
      this.drawFireEffect(context, effect);
      return;
    }

    if (effect.type === "cure") {
      this.drawCureEffect(context, effect);
    }
  }

  drawFireEffect(context, effect) {
    const scene = this.scene;

    if (Array.isArray(effect.target)) {
      for (const target of effect.target) {
        this.drawFireEffect(context, {
          ...effect,
          target: target,
        });
      }

      return;
    }

    const isAlly = $gameParty.battleMembers().includes(effect.target);

    if (!isAlly && !scene.enemies.includes(effect.target)) {
      return;
    }

    const progress = 1 - effect.timer / effect.duration;

    let enemyX;
    let enemyY;

    if (isAlly) {
      const allyPosition = scene.getAllyPosition(effect.target);
      const battleData = scene.getPartyBattleData(effect.target);

      const visualX = battleData?.visualX || 0;
      const visualY = battleData?.visualY || 0;

      enemyX = allyPosition.x + visualX;

      enemyY =
        allyPosition.y + visualY - effect.target.battleSpriteHeight * 0.5 - 35;
    } else {
      const enemyPosition = scene.getEnemyPosition(effect.target);
      const battleData = scene.getEnemyBattleData(effect.target);

      enemyX = enemyPosition.x + (battleData?.visualX || 0);

      enemyY = enemyPosition.y - effect.target.battleSpriteHeight * 0.5;
    }
    // Strongest in the middle of the effect
    const burst = Math.sin(progress * Math.PI);

    context.save();

    // ---------------------------------
    // OUTER FIRE GLOW
    // ---------------------------------

    const glowRadius = 30 + burst * 35;

    const glow = context.createRadialGradient(
      enemyX,
      enemyY,
      5,
      enemyX,
      enemyY,
      glowRadius,
    );

    glow.addColorStop(0, "rgba(255, 230, 80, 0.75)");
    glow.addColorStop(0.45, "rgba(255, 100, 20, 0.45)");
    glow.addColorStop(1, "rgba(255, 40, 0, 0)");

    context.fillStyle = glow;
    context.beginPath();
    context.arc(enemyX, enemyY, glowRadius, 0, Math.PI * 2);
    context.fill();

    // ---------------------------------
    // FLAME PARTICLES
    // ---------------------------------

    const flames = [
      { x: -28, y: 12, size: 15, speed: 42 },
      { x: -15, y: 4, size: 22, speed: 58 },
      { x: 0, y: 10, size: 25, speed: 72 },
      { x: 16, y: 2, size: 19, speed: 55 },
      { x: 30, y: 14, size: 14, speed: 45 },
      { x: -8, y: 18, size: 16, speed: 82 },
      { x: 10, y: 22, size: 13, speed: 68 },
    ];

    for (let i = 0; i < flames.length; i++) {
      const flame = flames[i];

      const wave = Math.sin(progress * 12 + i * 1.7) * 6;

      const x = enemyX + flame.x + wave * progress;
      const y = enemyY + flame.y - flame.speed * progress;

      const size = flame.size * (0.7 + burst * 0.5);

      const alpha = Math.max(0, 1 - progress);

      // Red/orange outer flame
      context.globalAlpha = alpha * 0.8;

      context.fillStyle = "rgba(255, 70, 10, 1)";
      context.beginPath();
      context.ellipse(x, y, size * 0.65, size, 0, 0, Math.PI * 2);
      context.fill();

      // Yellow inner flame
      context.globalAlpha = alpha;

      context.fillStyle = "rgba(255, 220, 70, 1)";
      context.beginPath();

      context.ellipse(
        x,
        y + size * 0.15,
        size * 0.3,
        size * 0.55,
        0,
        0,
        Math.PI * 2,
      );

      context.fill();
    }

    // ---------------------------------
    // IMPACT FLASH
    // ---------------------------------

    if (progress < 0.35) {
      const flashProgress = progress / 0.35;

      const flashRadius = 12 + flashProgress * 35;

      context.globalAlpha = 1 - flashProgress;

      context.fillStyle = "rgba(255, 245, 170, 1)";
      context.beginPath();
      context.arc(enemyX, enemyY, flashRadius, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  drawCureEffect(context, effect) {
    const scene = this.scene;

    if (!$gameParty.battleMembers().includes(effect.target)) {
      return;
    }

    const progress = 1 - effect.timer / effect.duration;

    const allyPosition = scene.getAllyPosition(effect.target);
    const battleData = scene.getPartyBattleData(effect.target);

    const visualX = battleData?.visualX || 0;
    const visualY = battleData?.visualY || 0;

    const playerX = allyPosition.x + visualX;
    const playerY = allyPosition.y + visualY - 25;

    const rise = progress * 70;

    const fade = Math.max(0, 1 - progress);

    context.save();

    // ---------------------------------
    // SOFT HEALING GLOW
    // ---------------------------------

    const glowRadius = 25 + Math.sin(progress * Math.PI) * 30;

    const glow = context.createRadialGradient(
      playerX,
      playerY,
      5,
      playerX,
      playerY,
      glowRadius,
    );

    glow.addColorStop(0, "rgba(230, 255, 210, 0.8)");
    glow.addColorStop(0.5, "rgba(120, 255, 150, 0.35)");
    glow.addColorStop(1, "rgba(80, 220, 120, 0)");

    context.fillStyle = glow;
    context.beginPath();
    context.arc(playerX, playerY, glowRadius, 0, Math.PI * 2);
    context.fill();

    // ---------------------------------
    // RISING HEAL PARTICLES
    // ---------------------------------

    const particles = [
      { x: -28, y: 15, size: 5, speed: 0.8 },
      { x: -12, y: 0, size: 7, speed: 1.0 },
      { x: 4, y: 18, size: 6, speed: 0.9 },
      { x: 20, y: 5, size: 5, speed: 1.1 },
      { x: 32, y: 22, size: 4, speed: 0.75 },
      { x: -4, y: 30, size: 5, speed: 1.2 },
    ];

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];

      const wave = Math.sin(progress * 8 + i * 1.5) * 8;

      const x = playerX + particle.x + wave * progress;
      const y = playerY + particle.y - rise * particle.speed;

      context.globalAlpha = fade;

      context.fillStyle = "rgba(180, 255, 200, 1)";
      context.beginPath();
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fill();
    }

    // ---------------------------------
    // HEALING RING
    // ---------------------------------

    const ringRadius = 18 + progress * 35;

    context.globalAlpha = fade * 0.8;

    context.strokeStyle = "rgba(200, 255, 220, 1)";

    context.lineWidth = 3;

    context.beginPath();
    context.arc(playerX, playerY, ringRadius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}
