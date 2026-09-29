"use strict";

class Window_Roster {
  constructor(party) {
    this.party = party;
    this.visible = false;
    this.focus = "active";
    this.activeIndex = 0;
    this.reserveIndex = 0;
    this.pendingActiveId = 0;
    this.activeViewport = new Window_ListViewport(this.party?.constructor?.MAX_BATTLE_MEMBERS || 3);
    this.reserveViewport = new Window_ListViewport(4);
    this.refreshLayout();
  }

  refreshLayout() {
    const screen = MenuScreenLayout.metrics();
    const margin = screen.margin;
    const gap = screen.gap;
    const headerHeight = screen.headerHeight;
    const footerHeight = 86;
    const contentY = margin + headerHeight + gap;
    const contentHeight = screen.bottom - contentY - footerHeight - gap;
    const columnWidth = (screen.width - gap) / 2;

    this.headerBounds = {
      x: margin,
      y: margin,
      width: screen.width,
      height: headerHeight,
    };
    this.activeBounds = {
      x: margin,
      y: contentY,
      width: columnWidth,
      height: contentHeight,
    };
    this.reserveBounds = {
      x: margin + columnWidth + gap,
      y: contentY,
      width: columnWidth,
      height: contentHeight,
    };
    this.footerBounds = {
      x: margin,
      y: contentY + contentHeight + gap,
      width: screen.width,
      height: footerHeight,
    };
  }

  show() {
    this.visible = true;
    this.focus = "active";
    this.pendingActiveId = 0;
    this.refreshLayout();
    this.clampIndices();
  }

  hide() {
    this.visible = false;
    this.pendingActiveId = 0;
  }

  isOpen() {
    return this.visible;
  }

  activeMembers() {
    return this.party?.battleMembers?.() || [];
  }

  reserveMembers() {
    if (typeof this.party?.reserveMembers === "function") {
      return this.party.reserveMembers();
    }

    const activeIds = new Set(this.activeMembers().map((actor) => actor.actorId));
    return (this.party?.members?.() || []).filter(
      (actor) => !activeIds.has(actor.actorId),
    );
  }

  focusedMembers() {
    return this.focus === "reserve" ? this.reserveMembers() : this.activeMembers();
  }

  focusedIndex() {
    return this.focus === "reserve" ? this.reserveIndex : this.activeIndex;
  }

  setFocusedIndex(index) {
    if (this.focus === "reserve") {
      this.reserveIndex = index;
    } else {
      this.activeIndex = index;
    }
  }

  currentActor() {
    return this.focusedMembers()[this.focusedIndex()] || null;
  }

  pendingActiveActor() {
    return this.party?.actorById?.(this.pendingActiveId) || null;
  }

  clampIndices() {
    const active = this.activeMembers();
    const reserve = this.reserveMembers();
    this.activeIndex = Math.max(0, Math.min(this.activeIndex, Math.max(0, active.length - 1)));
    this.reserveIndex = Math.max(0, Math.min(this.reserveIndex, Math.max(0, reserve.length - 1)));
    this.activeViewport.ensureVisible(this.activeIndex, active.length);
    this.reserveViewport.ensureVisible(this.reserveIndex, reserve.length);
  }

  moveSelection(offset) {
    const members = this.focusedMembers();
    if (members.length === 0) {
      return false;
    }

    const next = ((this.focusedIndex() + offset) % members.length + members.length) % members.length;
    this.setFocusedIndex(next);
    const viewport = this.focus === "reserve" ? this.reserveViewport : this.activeViewport;
    viewport.ensureVisible(next, members.length);
    return true;
  }

  switchFocus(focus) {
    if (!["active", "reserve"].includes(focus)) {
      return false;
    }

    this.focus = focus;
    this.clampIndices();
    return true;
  }

  protagonistActorId() {
    if (typeof DatabaseManager !== "undefined") {
      const configured = Number(DatabaseManager.system?.protagonistActorId);
      if (Number.isInteger(configured) && configured > 0) {
        return configured;
      }
    }

    return 1;
  }

  isRosterLockedActor(actor) {
    return Number(actor?.actorId) === this.protagonistActorId();
  }

  confirmSelection() {
    const actor = this.currentActor();
    if (!actor) {
      return false;
    }

    // ROSTER is a direct active <-> reserve exchange. The active party never
    // temporarily shrinks: choose an active source first, then its reserve
    // replacement.
    if (!this.pendingActiveId) {
      if (this.focus !== "active") {
        this.switchFocus("active");
        return true;
      }

      if (this.isRosterLockedActor(actor)) {
        return false;
      }

      if (this.reserveMembers().length === 0) {
        return false;
      }

      this.pendingActiveId = actor.actorId;
      this.switchFocus("reserve");
      return true;
    }

    if (this.focus !== "reserve") {
      this.switchFocus("reserve");
      return true;
    }

    const activeActor = this.pendingActiveActor();
    const replaced = this.party?.replaceBattleActor?.(activeActor, actor) === true;
    if (replaced) {
      this.pendingActiveId = 0;
      this.switchFocus("active");
    }
    this.clampIndices();
    return replaced;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isActionTriggered("cancel")) {
      if (this.pendingActiveId) {
        this.pendingActiveId = 0;
        this.switchFocus("active");
      } else {
        this.hide();
      }
      return;
    }

    if (Input.isActionTriggered("left")) {
      // ROSTER uses Cancel/Back as the only way to abandon a pending swap.
      // Left remains inert while choosing a reserve so directional input never
      // doubles as a hidden cancel command.
      return;
    }

    if (Input.isActionTriggered("right")) {
      // Reserve selection is entered by confirming an active actor. Keeping
      // horizontal focus locked until then makes ROSTER mirror Order's
      // pick-up -> destination interaction instead of acting like two lists.
      return;
    }

    if (Input.isActionTriggered("up")) {
      this.moveSelection(-1);
      return;
    }

    if (Input.isActionTriggered("down")) {
      this.moveSelection(1);
      return;
    }

    if (Input.isActionTriggered("confirm")) {
      this.confirmSelection();
    }
  }

  drawPanel(context, bounds, options = {}) {
    return Window_ActorSummary.drawPanel(context, bounds, options);
  }

  drawHeader(context) {
    const bounds = this.headerBounds;
    this.drawPanel(context, bounds);
    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = UIThemePalette?.primary?.() || "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText("ROSTER", bounds.x + 20, bounds.y + 24);
    context.fillStyle = UIThemePalette?.secondary?.() || "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(
      "Remote Operative Selection Tactical Engagement Registry",
      bounds.x + 20,
      bounds.y + 49,
    );
    context.restore();
  }

  drawSelection(context, x, y, width, height) {
    const drawn = UIAssetManager?.drawSelectionPanel?.(
      context,
      x,
      y,
      width,
      height,
      { alpha: 0.2 },
    );

    if (!drawn) {
      context.fillStyle = "rgba(255, 215, 90, 0.1)";
      context.fillRect(x, y, width, height);
    }
  }

  drawActorCard(context, actor, bounds, selected, statusLabel) {
    this.drawPanel(context, bounds, { assetAlpha: 0.34 });
    const pending = Number(actor?.actorId) === Number(this.pendingActiveId);
    if (selected || pending) {
      context.save();
      const pulse = pending
        ? 0.55 + 0.45 * Math.sin((globalThis.performance?.now?.() || Date.now()) / 180)
        : 1;
      context.strokeStyle = `rgba(255, 215, 90, ${0.9 * pulse})`;
      context.lineWidth = 3;
      const inset = 2;
      const radius = 11;
      context.beginPath();
      if (typeof context.roundRect === "function") {
        context.roundRect(
          bounds.x + inset,
          bounds.y + inset,
          bounds.width - inset * 2,
          bounds.height - inset * 2,
          radius,
        );
      } else {
        context.rect(bounds.x + inset, bounds.y + inset, bounds.width - inset * 2, bounds.height - inset * 2);
      }
      context.stroke();
      context.fillStyle = `rgba(255, 215, 90, ${0.07 * pulse})`;
      context.fill();
      context.restore();
    }

    const portraitSize = Math.min(92, bounds.height - 20);
    const portraitX = bounds.x + 10;
    const portraitY = bounds.y + (bounds.height - portraitSize) / 2;
    Window_ActorSummary.drawPortraitPlaceholder(
      context,
      actor,
      portraitX,
      portraitY,
      portraitSize,
    );

    const textX = portraitX + portraitSize + 14;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = selected ? "#ffd75a" : (UIThemePalette?.primary?.() || "#ffffff");
    context.font = selected ? "600 19px sans-serif" : "600 18px sans-serif";
    context.fillText(actor?.name || "Unknown", textX, bounds.y + bounds.height / 2 - 18);
    context.fillStyle = UIThemePalette?.secondary?.() || "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(`LV ${actor?.level ?? "?"}`, textX, bounds.y + bounds.height / 2 + 8);

    const gaugeX = textX;
    const gaugeWidth = Math.max(76, Math.min(112, bounds.width - (gaugeX - bounds.x) - 138));
    const hpY = bounds.y + bounds.height / 2 + 24;
    const mpY = hpY + 20;
    context.fillStyle = UIThemePalette?.secondary?.() || "#aebbd0";
    context.font = "11px sans-serif";
    context.fillText(`HP ${Math.floor(actor?.hp ?? 0)}/${Math.floor(actor?.maxHp ?? 0)}`, gaugeX, hpY);
    Window_ActorSummary.drawGauge(context, actor?.hp ?? 0, actor?.maxHp ?? 0, gaugeX, hpY + 5, gaugeWidth, "hp");
    context.fillText(`MP ${Math.floor(actor?.mp ?? 0)}/${Math.floor(actor?.maxMp ?? 0)}`, gaugeX + gaugeWidth + 12, hpY);
    Window_ActorSummary.drawGauge(context, actor?.mp ?? 0, actor?.maxMp ?? 0, gaugeX + gaugeWidth + 12, hpY + 5, gaugeWidth, "mp");

    context.textAlign = "right";
    context.fillStyle = statusLabel === "ACTIVE" ? "#78f0d2" : "#c7a7ff";
    context.font = "600 12px sans-serif";
    context.fillText(statusLabel, bounds.x + bounds.width - 14, bounds.y + bounds.height / 2 - 18);
  }

  drawReserveInfo(context, bounds, actor) {
    // The reserve-info region is permanent so the panel never changes shape.
    // Its contents appear only while a reserve actor is actually highlighted.
    const x = bounds.x + 22;
    const y = bounds.y + 58;
    context.save();

    // Permanent divider: this reserves the info box even while it is empty.
    context.strokeStyle = "rgba(210, 222, 242, 0.3)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.x + 18, y + 58);
    context.lineTo(bounds.x + bounds.width - 18, y + 58);
    context.stroke();

    if (actor && this.focus === "reserve" && this.pendingActiveId) {
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillStyle = UIThemePalette?.primary?.() || "#ffffff";
      context.font = "600 19px sans-serif";
      context.fillText(actor.name || "Unknown", x, y + 12);
      context.fillStyle = UIThemePalette?.secondary?.() || "#aebbd0";
      context.font = "14px sans-serif";
      context.fillText(`LV ${actor.level ?? "?"}`, x, y + 36);

      const gaugeX = x + 82;
      const gaugeGap = 22;
      const gaugeWidth = Math.max(92, Math.floor((bounds.width - 150 - gaugeGap) / 2));
      const hpX = gaugeX;
      const mpX = gaugeX + gaugeWidth + gaugeGap;
      context.fillText(`HP ${Math.floor(actor.hp ?? 0)}/${Math.floor(actor.maxHp ?? 0)}`, hpX, y + 30);
      context.fillText(`MP ${Math.floor(actor.mp ?? 0)}/${Math.floor(actor.maxMp ?? 0)}`, mpX, y + 30);
      Window_ActorSummary.drawGauge(context, actor?.hp ?? 0, actor?.maxHp ?? 0, hpX, y + 43, gaugeWidth, "hp");
      Window_ActorSummary.drawGauge(context, actor?.mp ?? 0, actor?.maxMp ?? 0, mpX, y + 43, gaugeWidth, "mp");
    }
    context.restore();
  }

  drawReserveGrid(context, bounds, members) {
    const index = this.reserveIndex;
    const showInfo = this.focus === "reserve" && Boolean(this.pendingActiveId);
    this.drawReserveInfo(context, bounds, showInfo ? members[index] : null);
    const gridX = bounds.x + 24;
    // Keep the portrait grid fixed below the permanent reserve-info region.
    const gridY = bounds.y + 140;
    const size = 92;
    const gap = 18;
    const columns = Math.max(1, Math.floor((bounds.width - 48 + gap) / (size + gap)));
    members.forEach((actor, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = gridX + col * (size + gap);
      const y = gridY + row * (size + gap);
      const selected = this.focus === "reserve" && i === index;
      if (selected) {
        context.save();
        context.strokeStyle = "rgba(255, 215, 90, 0.95)";
        context.lineWidth = 3;
        context.strokeRect(x - 5, y - 5, size + 10, size + 10);
        context.fillStyle = "rgba(255, 215, 90, 0.08)";
        context.fillRect(x - 4, y - 4, size + 8, size + 8);
        context.restore();
      }
      Window_ActorSummary.drawPortraitPlaceholder(context, actor, x, y, size);
    });
  }

  drawColumn(context, bounds, title, members, focusName, viewport) {
    this.drawPanel(context, bounds);
    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = this.focus === focusName ? "#ffd75a" : "#78f0d2";
    context.font = "600 18px sans-serif";
    context.fillText(title, bounds.x + 16, bounds.y + 24);

    context.strokeStyle = "rgba(210, 222, 242, 0.24)";
    context.beginPath();
    context.moveTo(bounds.x + 16, bounds.y + 44);
    context.lineTo(bounds.x + bounds.width - 16, bounds.y + 44);
    context.stroke();

    if (members.length === 0) {
      context.fillStyle = "#8897ac";
      context.font = "15px sans-serif";
      context.fillText(
        focusName === "active" ? "No active operatives." : "No reserve operatives.",
        bounds.x + 20,
        bounds.y + 82,
      );
      context.restore();
      return;
    }

    if (focusName === "reserve") {
      this.drawReserveGrid(context, bounds, members);
      context.restore();
      return;
    }

    const index = focusName === "active" ? this.activeIndex : this.reserveIndex;
    const range = viewport.visibleRange(index, members.length);
    const cardGap = 10;
    const visibleCount = Math.max(1, range.end - range.start);
    const availableHeight = bounds.height - 68;
    const activeSlots = this.party?.constructor?.MAX_BATTLE_MEMBERS || 3;
    const fillCount = focusName === "active" ? activeSlots : Math.min(3, Math.max(1, visibleCount));
    const naturalHeight = Math.floor(
      (availableHeight - cardGap * (fillCount - 1)) / fillCount,
    );
    const cardHeight = focusName === "reserve"
      ? Math.max(96, Math.min(132, naturalHeight))
      : Math.max(82, naturalHeight);
    let row = 0;

    for (let i = range.start; i < range.end; i++, row++) {
      const card = {
        x: bounds.x + 18,
        y: bounds.y + 56 + row * (cardHeight + cardGap),
        width: bounds.width - 36,
        height: cardHeight,
      };
      this.drawActorCard(
        context,
        members[i],
        card,
        this.focus === focusName && i === index,
        focusName === "active" ? "ACTIVE" : "RESERVE",
      );
    }

    context.textAlign = "right";
    context.fillStyle = "#ffffff";
    context.font = "15px sans-serif";
    if (viewport.hasPrevious()) {
      context.fillText("▲", bounds.x + bounds.width - 12, bounds.y + 66);
    }
    if (viewport.hasNext(members.length)) {
      context.fillText("▼", bounds.x + bounds.width - 12, bounds.y + bounds.height - 12);
    }
    context.restore();
  }

  footerText() {
    const pending = this.pendingActiveActor();
    if (pending) {
      const reserve = this.currentActor();
      return reserve
        ? `Swap ${pending.name} with ${reserve.name}. Confirm swaps; Back cancels.`
        : `Choose a reserve operative to replace ${pending.name}. Back cancels.`;
    }

    const actor = this.currentActor();
    if (!actor) {
      return "Recruit additional operatives to expand the registry.";
    }

    if (this.focus === "active") {
      if (this.isRosterLockedActor(actor)) {
        return `${actor.name} is story-locked as the protagonist and cannot be moved to reserve here.`;
      }
      return this.reserveMembers().length > 0
        ? `Select ${actor.name}, then choose the reserve operative who should take their active slot.`
        : "No reserve operatives are available to swap into the active party.";
    }

    return `Reserve: ${actor.name}. Select an active operative first to begin a swap.`;
  }

  drawFooter(context) {
    const bounds = this.footerBounds;
    this.drawPanel(context, bounds, { assetAlpha: 0.46 });
    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = UIThemePalette?.primary?.() || "#ffffff";
    context.font = "15px sans-serif";
    Window_TextLayout.drawWrappedTextCentered(
      context,
      this.footerText(),
      bounds.x + 18,
      bounds.y + bounds.height / 2,
      bounds.width - 36,
      18,
      2,
    );
    context.restore();
  }

  draw() {
    if (!this.visible) {
      return;
    }

    const context = Graphics.context;
    const active = this.activeMembers();
    const reserve = this.reserveMembers();
    this.clampIndices();

    context.save();
    this.drawHeader(context);
    this.drawColumn(context, this.activeBounds, "ACTIVE PARTY", active, "active", this.activeViewport);
    this.drawColumn(context, this.reserveBounds, "RESERVE", reserve, "reserve", this.reserveViewport);
    this.drawFooter(context);
    context.restore();
  }
}
