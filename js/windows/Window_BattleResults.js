"use strict";

class Window_BattleResults {
  static PAGE_COUNT = 2;
  static PAGE_EXP = 0;
  static PAGE_LOOT = 1;
  static STATE_WAITING = "waiting";
  static STATE_ANIMATING = "animating";
  static STATE_COMPLETE = "complete";
  static LEVEL_POPUP_SECONDS = 0.9;
  static ESSENCE_POPUP_SECONDS = 1.05;
  static EXP_ANIMATION_SECONDS = 1.5;
  static RUNE_ANIMATION_SECONDS = 1.35;

  constructor(scene = null) {
    this.scene = scene;
    this.visible = false;
    this.result = null;
    this.pageIndex = Window_BattleResults.PAGE_EXP;
    this.pageState = Window_BattleResults.STATE_WAITING;
    this.actorRows = [];
    this.lootLines = [];
    this.scrollIndex = 0;
    this.viewport = new Window_ListViewport(10);
    this.essencePopupQueue = [];
    this.activeEssencePopup = null;
    this.activeEssencePopupTimer = 0;
    this.visualRunes = 0;
    this.runesBefore = 0;
    this.runesAfter = 0;
    this.runeReward = 0;
    this.refreshLayout();
  }

  refreshLayout() {
    const margin = 8;
    this.width = Math.max(320, Graphics.width - margin * 2);
    this.height = Math.max(240, Graphics.height - margin * 2);
    this.x = margin;
    this.y = margin;
  }

  show(result) {
    if (!result || result.outcome !== "victory") {
      return false;
    }

    this.result = result;
    this.refreshLayout();
    this.pageIndex = Window_BattleResults.PAGE_EXP;
    this.actorRows = this.buildActorRows(result);
    this.lootLines = this.buildLootLines(result);
    this.essencePopupQueue = this.buildEssencePopupQueue(result);
    this.resolveRuneTotals(result);
    this.resetPageState();
    this.visible = true;
    return true;
  }

  hide() {
    this.visible = false;
  }

  isOpen() {
    return this.visible;
  }

  isFinalPage() {
    return this.pageIndex === Window_BattleResults.PAGE_LOOT;
  }

  isWaiting() {
    return this.pageState === Window_BattleResults.STATE_WAITING;
  }

  isAnimating() {
    return this.pageState === Window_BattleResults.STATE_ANIMATING;
  }

  isComplete() {
    return this.pageState === Window_BattleResults.STATE_COMPLETE;
  }

  pageTitle() {
    return this.pageIndex === Window_BattleResults.PAGE_EXP
      ? "EXP & RESONANCE"
      : "RUNES & ITEMS";
  }

  resetPageState() {
    this.pageState = Window_BattleResults.STATE_WAITING;
    this.scrollIndex = 0;
    this.viewport.reset(this.scrollIndex, this.lootLines.length);
    this.activeEssencePopup = null;
    this.activeEssencePopupTimer = 0;

    if (this.pageIndex === Window_BattleResults.PAGE_EXP) {
      for (const row of this.actorRows) {
        row.visualLevel = row.levelBefore;
        row.visualExp = row.expBefore;
        row.remainingExp = row.expGained;
        row.levelPopupTimer = 0;
      }
    } else {
      this.visualRunes = this.runesBefore;
    }
  }

  startAnimation() {
    if (!this.visible || !this.isWaiting()) {
      return false;
    }

    this.pageState = Window_BattleResults.STATE_ANIMATING;

    if (this.pageIndex === Window_BattleResults.PAGE_EXP) {
      const hasExp = this.actorRows.some((row) => row.remainingExp > 0);
      const hasEssenceMilestones = this.essencePopupQueue.length > 0;

      if (!hasExp && !hasEssenceMilestones) {
        this.pageState = Window_BattleResults.STATE_COMPLETE;
      }
    } else if (this.runeReward <= 0) {
      this.visualRunes = this.runesAfter;
      this.pageState = Window_BattleResults.STATE_COMPLETE;
    }

    return true;
  }

  handleConfirm() {
    if (!this.visible) {
      return false;
    }

    if (this.isWaiting()) {
      this.startAnimation();
      return false;
    }

    if (this.isAnimating()) {
      return false;
    }

    if (this.pageIndex === Window_BattleResults.PAGE_EXP) {
      this.pageIndex = Window_BattleResults.PAGE_LOOT;
      this.resetPageState();
      return false;
    }

    return true;
  }

  // Compatibility bridge for older callers/tests. A confirmation is consumed
  // until the final page has fully finished animating.
  advancePage() {
    return !this.handleConfirm();
  }

  update(deltaTime = 0) {
    if (!this.visible) {
      return;
    }

    const seconds = Math.max(0, Number(deltaTime) || 0);

    if (this.isAnimating()) {
      if (this.pageIndex === Window_BattleResults.PAGE_EXP) {
        this.updateExpAnimation(seconds);
      } else {
        this.updateRuneAnimation(seconds);
      }
    }

    if (this.pageIndex !== Window_BattleResults.PAGE_LOOT) {
      return;
    }

    if (Input.isActionTriggered("up")) {
      this.scrollIndex = Math.max(0, this.scrollIndex - 1);
      this.viewport.ensureVisible(this.scrollIndex, this.lootLines.length);
    }

    if (Input.isActionTriggered("down")) {
      this.scrollIndex = Math.min(
        Math.max(0, this.lootLines.length - 1),
        this.scrollIndex + 1,
      );
      this.viewport.ensureVisible(this.scrollIndex, this.lootLines.length);
    }
  }

  updateExpAnimation(deltaTime) {
    let expStillMoving = false;

    for (const row of this.actorRows) {
      if (row.levelPopupTimer > 0) {
        row.levelPopupTimer = Math.max(0, row.levelPopupTimer - deltaTime);
        expStillMoving = true;
        continue;
      }

      if (row.remainingExp <= 0) {
        continue;
      }

      expStillMoving = true;
      const required = this.expForLevel(row.visualLevel);
      const room = Math.max(0, required - row.visualExp);
      const rate = Math.max(
        55,
        Math.min(900, row.expGained / Window_BattleResults.EXP_ANIMATION_SECONDS),
      );
      const step = Math.min(row.remainingExp, room, rate * deltaTime);

      row.visualExp += step;
      row.remainingExp = Math.max(0, row.remainingExp - step);

      if (room <= step + 0.0001 && row.remainingExp > 0.0001) {
        row.visualLevel += 1;
        row.visualExp = 0;
        row.levelPopupTimer = Window_BattleResults.LEVEL_POPUP_SECONDS;
      } else if (
        room <= step + 0.0001 &&
        row.remainingExp <= 0.0001 &&
        row.levelAfter > row.visualLevel
      ) {
        row.visualLevel += 1;
        row.visualExp = 0;
        row.levelPopupTimer = Window_BattleResults.LEVEL_POPUP_SECONDS;
      }

      if (row.remainingExp <= 0.0001 && row.levelPopupTimer <= 0) {
        row.visualLevel = row.levelAfter;
        row.visualExp = row.expAfter;
      }
    }

    if (expStillMoving) {
      return;
    }

    for (const row of this.actorRows) {
      row.visualLevel = row.levelAfter;
      row.visualExp = row.expAfter;
    }

    if (this.activeEssencePopup) {
      this.activeEssencePopupTimer = Math.max(
        0,
        this.activeEssencePopupTimer - deltaTime,
      );

      if (this.activeEssencePopupTimer > 0) {
        return;
      }

      this.activeEssencePopup = null;
    }

    if (this.essencePopupQueue.length > 0) {
      this.activeEssencePopup = this.essencePopupQueue.shift();
      this.activeEssencePopupTimer = Window_BattleResults.ESSENCE_POPUP_SECONDS;
      return;
    }

    this.pageState = Window_BattleResults.STATE_COMPLETE;
  }

  updateRuneAnimation(deltaTime) {
    if (this.visualRunes >= this.runesAfter) {
      this.visualRunes = this.runesAfter;
      this.pageState = Window_BattleResults.STATE_COMPLETE;
      return;
    }

    const rate = Math.max(
      18,
      Math.min(5000, this.runeReward / Window_BattleResults.RUNE_ANIMATION_SECONDS),
    );
    this.visualRunes = Math.min(this.runesAfter, this.visualRunes + rate * deltaTime);

    if (this.visualRunes >= this.runesAfter - 0.0001) {
      this.visualRunes = this.runesAfter;
      this.pageState = Window_BattleResults.STATE_COMPLETE;
    }
  }

  expForLevel(level) {
    return Math.max(1, Math.floor(Number(level) || 1) * 100);
  }

  inferExpBefore(actor) {
    let level = Math.max(1, Number(actor?.levelAfter) || 1);
    let exp = Math.max(0, Number(actor?.expAfter) || 0);
    let remaining = Math.max(0, Number(actor?.expGained) || 0);

    while (remaining > 0.0001) {
      if (exp >= remaining) {
        exp -= remaining;
        remaining = 0;
        break;
      }

      remaining -= exp;
      level = Math.max(1, level - 1);
      exp = this.expForLevel(level);

      if (level === 1 && remaining > exp) {
        exp = Math.max(0, exp - remaining);
        remaining = 0;
      }
    }

    return Math.max(0, exp);
  }

  buildActorRows(result) {
    const party = Array.isArray(result.party) ? result.party : [];

    return party.slice(0, 4).map((actor) => {
      const levelBefore = Math.max(1, Number(actor?.levelBefore) || 1);
      const levelAfter = Math.max(levelBefore, Number(actor?.levelAfter) || levelBefore);
      const expGained = Math.max(0, Number(actor?.expGained) || 0);
      const expAfter = Math.max(0, Number(actor?.expAfter) || 0);
      const explicitBefore = Number(actor?.expBefore);
      const expBefore = Number.isFinite(explicitBefore)
        ? Math.max(0, explicitBefore)
        : this.inferExpBefore(actor);

      return {
        actorId: actor?.actorId ?? null,
        name: actor?.name || "Unknown Actor",
        wasDefeated: actor?.wasDefeated === true,
        levelBefore,
        levelAfter,
        expBefore,
        expAfter,
        expGained,
        visualLevel: levelBefore,
        visualExp: expBefore,
        remainingExp: expGained,
        levelPopupTimer: 0,
      };
    });
  }

  buildEssencePopupQueue(result) {
    const queue = [];
    const party = Array.isArray(result.party) ? result.party : [];

    for (const actor of party) {
      const essenceRewards = Array.isArray(actor?.essenceRewards)
        ? actor.essenceRewards
        : [];

      for (const essence of essenceRewards) {
        if (essence?.leveledUp === true) {
          queue.push({
            kind: "level",
            actorName: actor?.name || "Unknown Actor",
            essenceName: essence?.name || "Unknown Essence",
            oldLevel: Math.max(1, Number(essence?.oldLevel) || 1),
            newLevel: Math.max(1, Number(essence?.newLevel) || 1),
          });
        } else if (essence?.becameMasteryReady === true) {
          queue.push({
            kind: "mastery",
            actorName: actor?.name || "Unknown Actor",
            essenceName: essence?.name || "Unknown Essence",
          });
        }
      }
    }

    return queue;
  }

  buildLootLines(result) {
    const drops = Array.isArray(result.rewards?.drops) ? result.rewards.drops : [];

    if (drops.length === 0) {
      return [{ kind: "muted", text: "No item drops" }];
    }

    return drops.map((drop) => ({
      kind: "normal",
      text: `${drop?.name || "Unknown Item"} ×${Math.max(0, Number(drop?.quantity) || 0)}`,
    }));
  }

  resolveRuneTotals(result) {
    this.runeReward = Math.max(0, Number(result.rewards?.currency) || 0);
    const explicitBefore = Number(result.runesBefore);
    const explicitAfter = Number(result.runesAfter);

    if (Number.isFinite(explicitBefore) && Number.isFinite(explicitAfter)) {
      this.runesBefore = Math.max(0, explicitBefore);
      this.runesAfter = Math.max(this.runesBefore, explicitAfter);
    } else {
      const currentRunes =
        typeof $gameParty !== "undefined" && typeof $gameParty?.gil === "function"
          ? Math.max(0, Number($gameParty.gil()) || 0)
          : this.runeReward;
      this.runesAfter = currentRunes;
      this.runesBefore = Math.max(0, currentRunes - this.runeReward);
    }

    this.visualRunes = this.runesBefore;
  }

  themeColor(role, fallback) {
    return typeof UIThemePalette !== "undefined"
      ? UIThemePalette.color(role, fallback)
      : fallback;
  }

  drawPanel(context, bounds, role = "menuPanel", options = {}) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      UIAssetManager.drawPanel(
        context,
        role,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(18, 31, 104, 0.97)",
          fallbackStroke: "rgba(137, 182, 235, 0.88)",
          innerStroke: "rgba(232, 235, 255, 0.14)",
          assetAlpha: 0.5,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
      return;
    }

    context.fillStyle = options.fallbackFill || "rgba(18, 31, 104, 0.97)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = options.fallbackStroke || "rgba(137, 182, 235, 0.88)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  drawGauge(context, value, maximum, x, y, width) {
    const max = Math.max(1, Number(maximum) || 1);
    const current = Math.max(0, Math.min(max, Number(value) || 0));
    const color = this.themeColor("positive", "#ef8f8f");

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawGauge === "function"
    ) {
      UIAssetManager.drawGauge(context, current, max, x, y, width, 10, color);
      return;
    }

    context.fillStyle = "rgba(8, 13, 28, 0.92)";
    context.fillRect(x, y, width, 10);
    context.fillStyle = color;
    context.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * (current / max)), 8);
  }

  drawPortrait(context, actor, x, y, size) {
    if (
      typeof Window_ActorSummary !== "undefined" &&
      typeof Window_ActorSummary.drawPortraitPlaceholder === "function"
    ) {
      Window_ActorSummary.drawPortraitPlaceholder(context, actor, x, y, size);
      return;
    }

    const initial = String(actor?.name || "?").trim().charAt(0).toUpperCase() || "?";
    context.fillStyle = "rgba(12, 23, 45, 0.94)";
    context.fillRect(x, y, size, size);
    context.strokeStyle = "rgba(137, 182, 235, 0.85)";
    context.lineWidth = 1.5;
    context.strokeRect(x, y, size, size);
    context.fillStyle = "#f3f7fc";
    context.font = `600 ${Math.max(24, Math.floor(size * 0.4))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initial, x + size / 2, y + size / 2);
  }

  formatRunes(value) {
    if (
      typeof Game_Party !== "undefined" &&
      typeof Game_Party.formatRunes === "function"
    ) {
      return Game_Party.formatRunes(value);
    }

    return `${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString()} R`;
  }

  drawHeader(context, bounds, title) {
    this.drawPanel(context, bounds, "accentPanel", { assetAlpha: 0.56 });
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = this.themeColor("focus", "#ffd75a");
    context.font = "700 24px sans-serif";
    context.fillText(title, bounds.x + 20, bounds.y + bounds.height / 2);

    context.textAlign = "right";
    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "15px sans-serif";
    context.fillText(
      this.result?.encounter?.name || "Battle Complete",
      bounds.x + bounds.width - 20,
      bounds.y + 21,
    );
    context.fillText(
      `${this.pageIndex + 1} / ${Window_BattleResults.PAGE_COUNT}`,
      bounds.x + bounds.width - 20,
      bounds.y + 44,
    );
  }

  drawRewardStrip(context, bounds, leftLabel, leftValue, rightLabel, rightValue) {
    const gap = 8;
    const half = Math.floor((bounds.width - gap) / 2);
    const cards = [
      {
        x: bounds.x,
        y: bounds.y,
        width: half,
        height: bounds.height,
        label: leftLabel,
        value: leftValue,
      },
      {
        x: bounds.x + half + gap,
        y: bounds.y,
        width: bounds.width - half - gap,
        height: bounds.height,
        label: rightLabel,
        value: rightValue,
      },
    ];

    for (const card of cards) {
      this.drawPanel(context, card, "accentPanel", { assetAlpha: 0.42 });
      context.textBaseline = "middle";
      context.textAlign = "left";
      context.fillStyle = this.themeColor("secondary", "#aebbd0");
      context.font = "600 14px sans-serif";
      context.fillText(card.label, card.x + 18, card.y + card.height / 2);
      context.textAlign = "right";
      context.fillStyle = this.themeColor("primary", "#ffffff");
      context.font = "700 22px sans-serif";
      context.fillText(card.value, card.x + card.width - 18, card.y + card.height / 2);
    }
  }

  drawActorRow(context, row, bounds) {
    this.drawPanel(context, bounds, "menuPanel", { assetAlpha: 0.38, shadow: false });
    const portraitSize = Math.max(62, Math.min(88, bounds.height - 20));
    const portraitX = bounds.x + 16;
    const portraitY = bounds.y + (bounds.height - portraitSize) / 2;
    this.drawPortrait(context, row, portraitX, portraitY, portraitSize);

    const nameX = portraitX + portraitSize + 20;
    const centerY = bounds.y + bounds.height / 2;
    const expX = Math.max(nameX + 170, bounds.x + Math.floor(bounds.width * 0.42));
    const expWidth = Math.max(180, bounds.x + bounds.width - expX - 26);
    const required = this.expForLevel(row.visualLevel);
    const displayExp = Math.min(required, Math.max(0, Math.floor(row.visualExp + 0.0001)));
    const toNext = Math.max(0, required - displayExp);

    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "700 20px sans-serif";
    context.fillText(row.name, nameX, centerY - 21);

    context.fillStyle = this.themeColor("focus", "#ffd75a");
    context.font = "600 15px sans-serif";
    context.fillText("LEVEL", nameX, centerY + 12);
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "700 19px sans-serif";
    context.fillText(String(row.visualLevel), nameX + 58, centerY + 12);

    if (row.wasDefeated) {
      context.fillStyle = this.themeColor("muted", "#8897ac");
      context.font = "13px sans-serif";
      context.fillText("No Essence Resonance", nameX, centerY + 36);
    }

    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "600 14px sans-serif";
    context.fillText("EXP", expX, centerY - 32);
    context.textAlign = "right";
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "700 17px sans-serif";
    context.fillText(`${displayExp} / ${required}`, expX + expWidth, centerY - 32);

    this.drawGauge(context, displayExp, required, expX, centerY - 11, expWidth);

    context.textAlign = "left";
    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "14px sans-serif";
    context.fillText("Next level", expX, centerY + 21);
    context.textAlign = "right";
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.fillText(`${toNext} EXP`, expX + expWidth, centerY + 21);

    if (row.levelPopupTimer > 0) {
      const popupWidth = 138;
      const popupHeight = 34;
      const popup = {
        x: nameX - 2,
        y: bounds.y + bounds.height - popupHeight - 8,
        width: popupWidth,
        height: popupHeight,
      };
      this.drawPanel(context, popup, "accentPanel", {
        assetAlpha: 0.68,
        fallbackStroke: "rgba(255, 215, 90, 0.96)",
      });
      context.textAlign = "center";
      context.fillStyle = this.themeColor("focus", "#ffd75a");
      context.font = "700 16px sans-serif";
      context.fillText("LEVEL UP", popup.x + popup.width / 2, popup.y + popup.height / 2);
    }
  }

  drawEssencePopup(context) {
    const popup = this.activeEssencePopup;

    if (!popup) {
      return;
    }

    const width = Math.min(430, this.width - 80);
    const height = 82;
    const bounds = {
      x: this.x + (this.width - width) / 2,
      y: this.y + 92,
      width,
      height,
    };
    this.drawPanel(context, bounds, "accentPanel", {
      assetAlpha: 0.72,
      fallbackStroke: "rgba(255, 215, 90, 0.96)",
    });

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = this.themeColor("focus", "#ffd75a");
    context.font = "700 18px sans-serif";
    context.fillText(
      popup.kind === "mastery" ? "MASTERY READY" : "ESSENCE LEVEL UP",
      bounds.x + bounds.width / 2,
      bounds.y + 27,
    );
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "15px sans-serif";
    const detail = popup.kind === "mastery"
      ? `${popup.actorName} · ${popup.essenceName}`
      : `${popup.actorName} · ${popup.essenceName}  ${popup.oldLevel} → ${popup.newLevel}`;
    context.fillText(detail, bounds.x + bounds.width / 2, bounds.y + 55);
  }

  drawExpPage(context, content) {
    const rewards = this.result?.rewards || {};
    const strip = {
      x: content.x,
      y: content.y,
      width: content.width,
      height: 54,
    };
    this.drawRewardStrip(
      context,
      strip,
      "EXP GAINED",
      `+${Math.max(0, Number(rewards.exp) || 0)}`,
      "RESONANCE",
      `+${Math.max(0, Number(rewards.resonance) || 0)}`,
    );

    const rowsTop = strip.y + strip.height + 8;
    const rowsHeight = content.y + content.height - rowsTop;
    const count = Math.max(1, this.actorRows.length);
    const gap = 7;
    const rowHeight = Math.floor((rowsHeight - gap * (count - 1)) / count);

    if (this.actorRows.length === 0) {
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = this.themeColor("muted", "#8897ac");
      context.font = "16px sans-serif";
      context.fillText("No party progression to report.", content.x + content.width / 2, rowsTop + 50);
      return;
    }

    this.actorRows.forEach((row, index) => {
      this.drawActorRow(context, row, {
        x: content.x,
        y: rowsTop + index * (rowHeight + gap),
        width: content.width,
        height: rowHeight,
      });
    });

    this.drawEssencePopup(context);
  }

  drawLootPage(context, content) {
    const strip = {
      x: content.x,
      y: content.y,
      width: content.width,
      height: 62,
    };
    this.drawRewardStrip(
      context,
      strip,
      "GAINED RUNES",
      `+${this.formatRunes(this.runeReward)}`,
      "RUNES",
      this.formatRunes(this.visualRunes),
    );

    const list = {
      x: content.x,
      y: strip.y + strip.height + 8,
      width: content.width,
      height: content.y + content.height - (strip.y + strip.height + 8),
    };
    this.drawPanel(context, list, "menuPanel", { assetAlpha: 0.38, shadow: false });

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = this.themeColor("accent", "#7ff0d5");
    context.font = "700 17px sans-serif";
    context.fillText("ITEM DROPS", list.x + 18, list.y + 27);

    const rowHeight = 30;
    const startY = list.y + 64;
    this.viewport.maxVisibleRows = Math.max(
      1,
      Math.floor((list.height - 82) / rowHeight),
    );
    this.viewport.ensureVisible(this.scrollIndex, this.lootLines.length);
    const range = this.viewport.visibleRange(this.scrollIndex, this.lootLines.length);

    for (let index = range.start; index < range.end; index++) {
      const line = this.lootLines[index];
      context.textAlign = "left";
      context.fillStyle = line.kind === "muted"
        ? this.themeColor("muted", "#8897ac")
        : this.themeColor("primary", "#ffffff");
      context.font = "16px sans-serif";
      context.fillText(
        line.text,
        list.x + 22,
        startY + (index - range.start) * rowHeight,
        list.width - 44,
      );
    }

    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "15px sans-serif";
    context.textAlign = "right";

    if (this.viewport.hasPrevious()) {
      context.fillText("▲", list.x + list.width - 20, list.y + 27);
    }

    if (this.viewport.hasNext(this.lootLines.length)) {
      context.fillText("▼", list.x + list.width - 20, list.y + list.height - 18);
    }
  }

  footerText() {
    const confirm = Input.actionLabel("confirm");

    if (this.isWaiting()) {
      return `${confirm}: Begin`;
    }

    if (this.isAnimating()) {
      return this.pageIndex === Window_BattleResults.PAGE_EXP
        ? "Updating EXP..."
        : "Counting Runes...";
    }

    return `${confirm}: ${this.isFinalPage() ? "Continue" : "Next"}`;
  }

  draw() {
    if (!this.visible || !this.result) {
      return;
    }

    this.refreshLayout();
    const context = Graphics.context;
    const outer = { x: this.x, y: this.y, width: this.width, height: this.height };
    const inset = 12;
    const header = {
      x: outer.x + inset,
      y: outer.y + inset,
      width: outer.width - inset * 2,
      height: 62,
    };
    const footerHeight = 36;
    const content = {
      x: header.x,
      y: header.y + header.height + 8,
      width: header.width,
      height: outer.y + outer.height - footerHeight - 10 - (header.y + header.height + 8),
    };

    context.save();
    context.fillStyle = "rgba(3, 6, 14, 0.84)";
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    this.drawPanel(context, outer, "menuPanel", { assetAlpha: 0.62 });
    this.drawHeader(
      context,
      header,
      this.pageIndex === Window_BattleResults.PAGE_EXP ? "Gained EXP." : "Gained Runes.",
    );

    if (this.pageIndex === Window_BattleResults.PAGE_EXP) {
      this.drawExpPage(context, content);
    } else {
      this.drawLootPage(context, content);
    }

    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "15px sans-serif";
    context.fillText(
      this.footerText(),
      outer.x + outer.width - 20,
      outer.y + outer.height - 19,
    );
    context.restore();
  }
}
