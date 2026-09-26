"use strict";

class Window_Roster {
  constructor(party) {
    this.party = party;
    this.visible = false;
    this.focus = "active";
    this.activeIndex = 0;
    this.reserveIndex = 0;
    this.pendingReserveId = 0;
    this.activeViewport = new Window_ListViewport(4);
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
    this.pendingReserveId = 0;
    this.refreshLayout();
    this.clampIndices();
  }

  hide() {
    this.visible = false;
    this.pendingReserveId = 0;
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

  pendingReserveActor() {
    return this.party?.actorById?.(this.pendingReserveId) || null;
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

    if (this.pendingReserveId) {
      if (this.focus !== "active") {
        this.switchFocus("active");
        return true;
      }

      if (this.isRosterLockedActor(actor)) {
        return false;
      }

      const reserveActor = this.pendingReserveActor();
      const replaced = this.party?.replaceBattleActor?.(actor, reserveActor) === true;
      if (replaced) {
        this.pendingReserveId = 0;
        this.switchFocus("active");
      }
      this.clampIndices();
      return replaced;
    }

    if (this.focus === "active") {
      if (this.isRosterLockedActor(actor)) {
        return false;
      }

      const reserved = this.party?.reserveBattleActor?.(actor) === true;
      this.clampIndices();
      return reserved;
    }

    if (this.activeMembers().length < 4) {
      const activated = this.party?.activateBattleActor?.(actor) === true;
      this.clampIndices();
      return activated;
    }

    this.pendingReserveId = actor.actorId;
    this.switchFocus("active");
    return true;
  }

  update() {
    if (!this.visible) {
      return;
    }

    if (Input.isActionTriggered("cancel")) {
      if (this.pendingReserveId) {
        this.pendingReserveId = 0;
        this.switchFocus("reserve");
      } else {
        this.hide();
      }
      return;
    }

    if (Input.isActionTriggered("left")) {
      this.switchFocus("active");
      return;
    }

    if (Input.isActionTriggered("right")) {
      this.switchFocus("reserve");
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
    if (selected) {
      this.drawSelection(context, bounds.x, bounds.y, bounds.width, bounds.height);
    }

    const portraitSize = Math.min(58, bounds.height - 14);
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
    context.font = selected ? "600 17px sans-serif" : "17px sans-serif";
    context.fillText(actor?.name || "Unknown", textX, bounds.y + 23);
    context.fillStyle = UIThemePalette?.secondary?.() || "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(
      `LV ${actor?.level ?? "?"}   HP ${Math.floor(actor?.hp ?? 0)}/${Math.floor(actor?.maxHp ?? 0)}   MP ${Math.floor(actor?.mp ?? 0)}/${Math.floor(actor?.maxMp ?? 0)}`,
      textX,
      bounds.y + 48,
    );

    context.textAlign = "right";
    context.fillStyle = statusLabel === "ACTIVE" ? "#78f0d2" : "#c7a7ff";
    context.font = "600 12px sans-serif";
    context.fillText(statusLabel, bounds.x + bounds.width - 12, bounds.y + 23);
  }

  drawColumn(context, bounds, title, members, focusName, viewport) {
    this.drawPanel(context, bounds);
    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = this.focus === focusName ? "#ffd75a" : "#78f0d2";
    context.font = "600 18px sans-serif";
    const suffix = focusName === "active" ? `${members.length}/4` : String(members.length);
    context.fillText(`${title}  ${suffix}`, bounds.x + 16, bounds.y + 24);

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

    const index = focusName === "active" ? this.activeIndex : this.reserveIndex;
    const range = viewport.visibleRange(index, members.length);
    const cardGap = 8;
    const cardHeight = Math.min(82, Math.floor((bounds.height - 68 - cardGap * 3) / 4));
    let row = 0;

    for (let i = range.start; i < range.end; i++, row++) {
      const card = {
        x: bounds.x + 12,
        y: bounds.y + 56 + row * (cardHeight + cardGap),
        width: bounds.width - 24,
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
    const pending = this.pendingReserveActor();
    if (pending) {
      return `Choose an active operative to replace with ${pending.name}. Back cancels the pending swap.`;
    }

    const actor = this.currentActor();
    if (!actor) {
      return "Recruit additional operatives to expand the registry.";
    }

    if (this.focus === "active") {
      if (this.isRosterLockedActor(actor)) {
        return `${actor.name} is story-locked as the protagonist and cannot be moved to reserve here.`;
      }

      return this.activeMembers().length <= 1
        ? `${actor.name} is the last active operative and cannot be moved to reserve.`
        : `Move ${actor.name} to reserve. Active battle parties may contain up to four operatives.`;
    }

    return this.activeMembers().length < 4
      ? `Move ${actor.name} into the active battle party.`
      : `The active party is full. Select ${actor.name}, then choose the active operative they should replace.`;
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
