"use strict";

class Window_ActorNavigator {
  constructor(source) {
    this.party = typeof source?.members === "function" ? source : null;
    this.fallbackActor = this.party ? null : source || null;
    this.actorIndex = 0;
  }

  members() {
    if (this.party) {
      if (typeof this.party.battleFormationMembers === "function") {
        return this.party.battleFormationMembers() || [];
      }

      if (typeof this.party.battleMembers === "function") {
        return this.party.battleMembers() || [];
      }

      return this.party.members() || [];
    }

    return this.fallbackActor ? [this.fallbackActor] : [];
  }

  actor() {
    return this.members()[this.actorIndex] || null;
  }

  selectActor(actorOrId) {
    const actorId = Number(actorOrId?.actorId ?? actorOrId);
    const members = this.members();
    const index = members.findIndex((member) => member?.actorId === actorId);

    if (index < 0) {
      return false;
    }

    this.actorIndex = index;
    return true;
  }

  changeActor(offset) {
    const members = this.members();

    if (members.length <= 1) {
      this.actorIndex = 0;
      return false;
    }

    const numericOffset = Number(offset);

    if (!Number.isInteger(numericOffset) || numericOffset === 0) {
      return false;
    }

    this.actorIndex =
      ((this.actorIndex + numericOffset) % members.length + members.length) %
      members.length;
    return true;
  }

  update() {
    if (Input.isActionTriggered("left")) {
      return this.changeActor(-1);
    }

    if (Input.isActionTriggered("right")) {
      return this.changeActor(1);
    }

    return false;
  }

  drawHeader(context, title, x, y, width, padding) {
    const actor = this.actor();

    context.fillStyle = "#ffffff";
    context.font = "28px sans-serif";
    context.textAlign = "left";
    context.fillText(title, x + padding, y + 42);

    const members = this.members();
    const actorLabel = !actor
      ? "No party members"
      : members.length > 1
        ? `◀  ${actor.name}  ▶`
        : actor.name;

    context.font = "20px sans-serif";
    context.textAlign = "right";
    context.fillText(
      actorLabel,
      x + width - padding,
      y + 42,
    );
    context.textAlign = "left";

    context.beginPath();
    context.moveTo(x + padding, y + 62);
    context.lineTo(x + width - padding, y + 62);
    context.stroke();
  }
}
