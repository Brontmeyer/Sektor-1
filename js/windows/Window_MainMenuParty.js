"use strict";

class Window_MainMenuParty {
  constructor(party, bounds = {}) {
    this.party = party;
    this.setBounds(bounds);
  }

  setBounds(bounds = {}) {
    this.x = Number(bounds.x) || 0;
    this.y = Number(bounds.y) || 0;
    this.width = Math.max(320, Number(bounds.width) || 720);
    this.height = Math.max(360, Number(bounds.height) || 560);
  }

  members() {
    const members = this.party?.battleMembers?.() || [];
    return members.slice(0, 4);
  }

  statusText(actor) {
    const summary = actor?.statusSummary?.(1) || "";
    return summary || "Normal";
  }

  drawPanel(context, x, y, width, height, options = {}) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      return UIAssetManager.drawPanel(
        context,
        "menuPanel",
        x,
        y,
        width,
        height,
        {
          fallbackFill: "rgba(14, 20, 32, 0.92)",
          fallbackStroke: "rgba(129, 166, 222, 0.72)",
          innerStroke: "rgba(222, 235, 248, 0.14)",
          lineWidth: 1.5,
          assetAlpha: 0.52,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
    }

    context.fillStyle = options.fallbackFill || "rgba(14, 20, 32, 0.92)";
    context.fillRect(x, y, width, height);
    context.strokeStyle =
      options.fallbackStroke || "rgba(129, 166, 222, 0.72)";
    context.lineWidth = options.lineWidth || 1.5;
    context.strokeRect(x, y, width, height);
    return false;
  }

  drawPortraitPlaceholder(context, actor, x, y, size) {
    const radius = Math.min(12, size / 5);
    const canRound =
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.roundedRectPath === "function" &&
      UIAssetManager.roundedRectPath(context, x, y, size, size, radius);

    context.save();
    if (canRound && typeof context.fill === "function") {
      context.fillStyle = "rgba(19, 30, 49, 0.96)";
      context.fill();
      context.strokeStyle = "rgba(142, 180, 236, 0.72)";
      context.lineWidth = 1.25;
      context.stroke();
    } else {
      context.fillStyle = "rgba(19, 30, 49, 0.96)";
      context.fillRect(x, y, size, size);
      context.strokeStyle = "rgba(142, 180, 236, 0.72)";
      context.strokeRect(x, y, size, size);
    }

    const initial = String(actor?.name || "?").trim().charAt(0).toUpperCase() || "?";
    context.fillStyle = "#eef4fb";
    context.font = `600 ${Math.max(24, Math.floor(size * 0.4))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initial, x + size / 2, y + size / 2);
    context.restore();
  }

  drawGauge(context, value, maximum, x, y, width, color) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawGauge === "function"
    ) {
      UIAssetManager.drawGauge(context, value, maximum, x, y, width, 10, color);
      return;
    }

    const max = Math.max(1, Number(maximum) || 1);
    const current = Math.max(0, Number(value) || 0);
    const rate = Math.max(0, Math.min(1, current / max));
    context.fillStyle = "rgba(15, 20, 28, 0.9)";
    context.fillRect(x, y, width, 10);
    context.fillStyle = color;
    context.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * rate), 8);
  }

  drawActorCard(context, actor, index, x, y, width, height) {
    this.drawPanel(context, x, y, width, height, {
      assetAlpha: index % 2 === 0 ? 0.42 : 0.36,
      shadow: false,
    });

    const padding = 14;
    const portraitSize = Math.max(58, Math.min(86, height - padding * 2));
    const portraitX = x + padding;
    const portraitY = y + (height - portraitSize) / 2;
    this.drawPortraitPlaceholder(
      context,
      actor,
      portraitX,
      portraitY,
      portraitSize,
    );

    const infoX = portraitX + portraitSize + 18;
    const infoWidth = Math.max(180, width - (infoX - x) - padding);
    const statX = infoX + Math.max(180, Math.floor(infoWidth * 0.38));
    const gaugeWidth = Math.max(74, Math.floor((infoWidth - (statX - infoX) - 18) / 3));
    const gaugeGap = 10;
    const topY = y + 29;

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#f4f7fb";
    context.font = "600 20px sans-serif";
    context.fillText(actor?.name || "Unknown", infoX, topY);

    const nameWidth = context.measureText?.(actor?.name || "Unknown")?.width || 80;
    context.fillStyle = "#ffd75a";
    context.font = "600 16px sans-serif";
    context.fillText(`LV ${actor?.level ?? "?"}`, infoX + nameWidth + 14, topY);

    context.font = "15px sans-serif";
    context.fillStyle = "#a8b8ca";
    context.fillText("Status:", infoX, topY + 27);
    context.fillStyle = this.statusText(actor) === "Normal" ? "#55e0c2" : "#ff89c8";
    context.fillText(this.statusText(actor), infoX + 54, topY + 27);

    const requiredExp = actor?.expForNextLevel?.();
    const expText = Number.isFinite(Number(requiredExp))
      ? `${Math.max(0, Number(actor?.exp) || 0)} / ${requiredExp}`
      : "-- / --";
    context.fillStyle = "#a8b8ca";
    context.fillText("Next Level:", infoX, topY + 52);
    context.fillStyle = "#eef4fb";
    context.fillText(expText, infoX + 82, topY + 52);

    const gaugeY = topY + 20;
    const stats = [
      {
        label: "HP",
        value: actor?.hp ?? 0,
        maximum: actor?.maxHp ?? 0,
        color: "#5cd477",
      },
      {
        label: "MP",
        value: actor?.mp ?? 0,
        maximum: actor?.maxMp ?? 0,
        color: "#45aaff",
      },
      {
        label: "VALOR",
        value: actor?.valor ?? 0,
        maximum: actor?.maxValor ?? 0,
        color: "#f2aa3f",
      },
    ];

    stats.forEach((stat, statIndex) => {
      const gx = statX + statIndex * (gaugeWidth + gaugeGap);
      context.fillStyle = stat.color;
      context.font = "600 13px sans-serif";
      const displayValue = Math.floor(Math.max(0, Number(stat.value) || 0));
      const displayMax = Math.floor(Math.max(0, Number(stat.maximum) || 0));
      const label = stat.label === "VALOR"
        ? `${stat.label} ${displayValue}/${displayMax}`
        : `${stat.label} ${displayValue}/${displayMax}`;
      context.fillText(label, gx, gaugeY);
      this.drawGauge(
        context,
        stat.value,
        stat.maximum,
        gx,
        gaugeY + 7,
        gaugeWidth,
        stat.color,
      );
    });
  }

  draw() {
    const context = Graphics.context;
    const members = this.members();

    context.save();
    this.drawPanel(context, this.x, this.y, this.width, this.height, {
      assetAlpha: 0.48,
    });

    context.fillStyle = "#f3f7fc";
    context.font = "600 16px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText("PARTY INFORMATION", this.x + 20, this.y + 28);

    const cardGap = 10;
    const contentTop = this.y + 42;
    const contentBottom = this.y + this.height - 14;
    const cardHeight = Math.max(
      94,
      (contentBottom - contentTop - cardGap * 3) / 4,
    );
    const cardX = this.x + 12;
    const cardWidth = this.width - 24;

    for (let index = 0; index < 4; index++) {
      const actor = members[index] || null;
      const cardY = contentTop + index * (cardHeight + cardGap);

      if (actor) {
        this.drawActorCard(
          context,
          actor,
          index,
          cardX,
          cardY,
          cardWidth,
          cardHeight,
        );
      } else {
        this.drawPanel(context, cardX, cardY, cardWidth, cardHeight, {
          assetAlpha: 0.24,
          shadow: false,
        });
        context.fillStyle = "rgba(205, 218, 232, 0.52)";
        context.font = "16px sans-serif";
        context.fillText("Empty Party Slot", cardX + 18, cardY + 31);
      }
    }

    context.restore();
  }
}
