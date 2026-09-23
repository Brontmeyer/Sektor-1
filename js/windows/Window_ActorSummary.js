"use strict";

class Window_ActorSummary {
  static resourceText(resource) {
    return typeof UIResourcePalette !== "undefined"
      ? UIResourcePalette.text(resource)
      : resource === "hp"
        ? "#66d7ff"
        : "#78ef91";
  }

  static valueText() {
    return typeof UIResourcePalette !== "undefined"
      ? UIResourcePalette.valueText()
      : "#ffffff";
  }

  static resourceFill(resource) {
    if (
      typeof UIResourcePalette !== "undefined" &&
      typeof UIResourcePalette.fill === "function"
    ) {
      return UIResourcePalette.fill(resource);
    }

    return resource === "hp" ? "#35baf3" : "#55d872";
  }

  static drawPanel(context, bounds, options = {}) {
    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawPanel === "function"
    ) {
      return UIAssetManager.drawPanel(
        context,
        "menuPanel",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        {
          fallbackFill: "rgba(11, 16, 28, 0.96)",
          fallbackStroke: "rgba(150, 176, 220, 0.78)",
          lineWidth: 1.5,
          assetAlpha: 0.54,
          sourceMargin: 12,
          destMargin: 12,
          ...options,
        },
      );
    }

    context.fillStyle = options.fallbackFill || "rgba(11, 16, 28, 0.96)";
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.strokeStyle = options.fallbackStroke || "rgba(150, 176, 220, 0.78)";
    context.lineWidth = 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  static drawPortraitPlaceholder(context, actor, x, y, size) {
    const initial =
      String(actor?.name || "?").trim().charAt(0).toUpperCase() || "?";

    context.fillStyle = "rgba(12, 23, 45, 0.94)";
    context.fillRect(x, y, size, size);
    context.strokeStyle = "rgba(137, 182, 235, 0.85)";
    context.lineWidth = 1.5;
    context.strokeRect(x, y, size, size);
    context.fillStyle = "#f3f7fc";
    context.font = `600 ${Math.max(28, Math.floor(size * 0.4))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initial, x + size / 2, y + size / 2);
  }

  static drawGauge(context, value, maximum, x, y, width, resource) {
    const color = this.resourceFill(resource);

    if (
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawGauge === "function"
    ) {
      UIAssetManager.drawGauge(context, value, maximum, x, y, width, 7, color);
      return;
    }

    const max = Math.max(1, Number(maximum) || 1);
    const current = Math.max(0, Number(value) || 0);
    const rate = Math.max(0, Math.min(1, current / max));
    context.fillStyle = "rgba(11, 15, 23, 0.92)";
    context.fillRect(x, y, width, 7);
    context.fillStyle = color;
    context.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * rate), 5);
  }

  static draw(context, actor, bounds) {
    this.drawPanel(context, bounds);

    const portraitSize = Math.min(104, bounds.height - 34);
    const portraitX = bounds.x + 18;
    const portraitY = bounds.y + (bounds.height - portraitSize) / 2;
    this.drawPortraitPlaceholder(context, actor, portraitX, portraitY, portraitSize);

    const infoX = portraitX + portraitSize + 20;
    const nameY = bounds.y + 37;

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText(actor?.name || "Unknown", infoX, nameY);

    const levelY = nameY + 23;
    context.fillStyle = "#ffd75a";
    context.font = "600 16px sans-serif";
    context.fillText("LV", infoX, levelY);
    context.fillStyle = this.valueText();
    context.fillText(String(actor?.level ?? "?"), infoX + 28, levelY);

    const statX = infoX;
    const statWidth = Math.max(118, Math.min(168, bounds.width * 0.22));
    const hpY = levelY + 28;
    const mpY = hpY + 30;
    const stats = [
      {
        label: "HP",
        resource: "hp",
        value: actor?.hp ?? 0,
        maximum: actor?.maxHp ?? 0,
        y: hpY,
      },
      {
        label: "MP",
        resource: "mp",
        value: actor?.mp ?? 0,
        maximum: actor?.maxMp ?? 0,
        y: mpY,
      },
    ];

    context.font = "600 15px sans-serif";

    for (const stat of stats) {
      context.fillStyle = this.resourceText(stat.resource);
      context.fillText(stat.label, statX, stat.y);
      context.fillStyle = this.valueText();
      context.fillText(
        `${Math.floor(Math.max(0, Number(stat.value) || 0))}/${Math.floor(
          Math.max(0, Number(stat.maximum) || 0),
        )}`,
        statX + 28,
        stat.y,
      );
      this.drawGauge(
        context,
        stat.value,
        stat.maximum,
        statX,
        stat.y + 7,
        statWidth,
        stat.resource,
      );
    }

    return {
      portrait: { x: portraitX, y: portraitY, size: portraitSize },
      identityX: infoX,
      contentX: statX + statWidth + 28,
    };
  }
}
