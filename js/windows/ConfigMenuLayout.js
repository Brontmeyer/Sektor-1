"use strict";

class ConfigMenuLayout {
  static calculate() {
    const margin = Math.max(12, Math.min(22, Math.floor(Graphics.width * 0.014)));
    const gap = 8;
    const width = Graphics.width - margin * 2;
    const height = Graphics.height - margin * 2;
    const headerHeight = 70;
    const titleWidth = Math.max(250, Math.min(320, Math.floor(width * 0.255)));

    return {
      x: margin,
      y: margin,
      width,
      height,
      gap,
      headerHeight,
      titleWidth,
      descriptionBounds: {
        x: margin,
        y: margin,
        width: width - titleWidth - gap,
        height: headerHeight,
      },
      titleBounds: {
        x: margin + width - titleWidth,
        y: margin,
        width: titleWidth,
        height: headerHeight,
      },
      contentBounds: {
        x: margin,
        y: margin + headerHeight + gap,
        width,
        height: height - headerHeight - gap,
      },
    };
  }

  static split(bounds, ratio = 0.5, gap = 8) {
    const safeGap = Math.max(0, Number(gap) || 0);
    const leftWidth = Math.floor((bounds.width - safeGap) * ratio);

    return {
      left: {
        x: bounds.x,
        y: bounds.y,
        width: leftWidth,
        height: bounds.height,
      },
      right: {
        x: bounds.x + leftWidth + safeGap,
        y: bounds.y,
        width: bounds.width - leftWidth - safeGap,
        height: bounds.height,
      },
    };
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
          innerStroke: "rgba(232, 234, 255, 0.14)",
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
    context.strokeStyle =
      options.fallbackStroke || "rgba(150, 176, 220, 0.78)";
    context.lineWidth = options.lineWidth || 1.5;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    return false;
  }

  static drawSelection(context, x, y, width, height, options = {}) {
    const drawn =
      typeof UIAssetManager !== "undefined" &&
      typeof UIAssetManager.drawSelectionPanel === "function" &&
      UIAssetManager.drawSelectionPanel(context, x, y, width, height, {
        alpha: 0.2,
        ...options,
      });

    if (!drawn) {
      context.fillStyle = options.fallbackFill || "rgba(255, 215, 90, 0.1)";
      context.fillRect(x, y, width, height);
    }

    return drawn;
  }

  static drawHeader(context, layout, { title, subtitle, description }) {
    const descriptionBounds = layout.descriptionBounds;
    const titleBounds = layout.titleBounds;

    this.drawPanel(context, descriptionBounds, { assetAlpha: 0.46 });
    this.drawPanel(context, titleBounds, { assetAlpha: 0.54 });

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "left";
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.primary()
      : "#ffffff";
    context.font = "17px sans-serif";

    const text = description || "Configure Sektor 1.";
    if (
      typeof Window_TextLayout !== "undefined" &&
      typeof Window_TextLayout.drawWrappedTextCentered === "function"
    ) {
      Window_TextLayout.drawWrappedTextCentered(
        context,
        text,
        descriptionBounds.x + 20,
        descriptionBounds.y + descriptionBounds.height / 2,
        descriptionBounds.width - 40,
        18,
        2,
      );
    } else {
      context.fillText(
        text,
        descriptionBounds.x + 20,
        descriptionBounds.y + descriptionBounds.height / 2,
        descriptionBounds.width - 40,
      );
    }

    context.textAlign = "center";
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.primary()
      : "#ffffff";
    context.font = "600 22px sans-serif";
    context.fillText(
      String(title || "CONFIG"),
      titleBounds.x + titleBounds.width / 2,
      titleBounds.y + 27,
    );
    context.fillStyle = typeof UIThemePalette !== "undefined"
      ? UIThemePalette.secondary()
      : "#aebbd0";
    context.font = "13px sans-serif";
    context.fillText(
      String(subtitle || "SYSTEM"),
      titleBounds.x + titleBounds.width / 2,
      titleBounds.y + 50,
    );
    context.restore();
  }
}
