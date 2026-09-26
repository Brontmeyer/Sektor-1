"use strict";

class CharacterMenuLayout {
  static calculate(options = {}) {
    const screen = MenuScreenLayout.metrics();
    const margin = screen.margin;
    const gap = screen.gap;
    const width = screen.width;
    const height = screen.height;
    const headerHeight = Math.max(150, Math.min(174, Math.floor(height * 0.245)));
    const infoWidth = Math.max(260, Math.min(320, Math.floor(width * 0.255)));
    const descriptionHeight = options.description === false ? 0 : 56;

    const actorBounds = {
      x: margin,
      y: margin,
      width: width - infoWidth - gap,
      height: headerHeight,
    };
    const infoBounds = {
      x: actorBounds.x + actorBounds.width + gap,
      y: margin,
      width: infoWidth,
      height: headerHeight,
    };

    const descriptionBounds = descriptionHeight > 0
      ? {
        x: margin,
        y: margin + headerHeight + gap,
        width,
        height: descriptionHeight,
      }
      : null;

    const contentY = descriptionBounds
      ? descriptionBounds.y + descriptionBounds.height + gap
      : margin + headerHeight + gap;

    return {
      x: margin,
      y: margin,
      width,
      height,
      gap,
      headerHeight,
      infoWidth,
      descriptionHeight,
      actorBounds,
      infoBounds,
      descriptionBounds,
      contentBounds: {
        x: margin,
        y: contentY,
        width,
        height: margin + height - contentY,
      },
    };
  }


  static themeColor(role, fallback) {
    if (typeof UIThemePalette !== "undefined" && typeof UIThemePalette[role] === "function") {
      return UIThemePalette[role]();
    }

    return fallback;
  }

  static infoHeadingMetrics(bounds, options = {}) {
    const hasSubtitle = Boolean(options.subtitle);

    return {
      titleY: bounds.y + 30,
      subtitleY: bounds.y + 52,
      rowStartY: bounds.y + (hasSubtitle ? 80 : 66),
      rowSpacing: 24,
      labelX: bounds.x + 18,
      valueX: bounds.x + bounds.width - 18,
    };
  }

  static drawInfoHeading(context, bounds, options = {}) {
    const title = String(options.title || "").trim();
    const subtitle = String(options.subtitle || "").trim();
    const metrics = this.infoHeadingMetrics(bounds, { subtitle });

    context.save();
    context.textBaseline = "middle";
    context.textAlign = "center";
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "600 22px sans-serif";
    context.fillText(title, bounds.x + bounds.width / 2, metrics.titleY);

    if (subtitle) {
      context.fillStyle = this.themeColor("secondary", "#aebbd0");
      context.font = "13px sans-serif";
      context.fillText(subtitle, bounds.x + bounds.width / 2, metrics.subtitleY);
    }

    context.restore();
    return metrics;
  }

  static infoRowY(bounds, index, options = {}) {
    const metrics = this.infoHeadingMetrics(bounds, options);
    const rowSpacing = Number(options.rowSpacing) || metrics.rowSpacing;
    return metrics.rowStartY + Math.max(0, Number(index) || 0) * rowSpacing;
  }

  static drawContextHeading(context, bounds, options = {}) {
    const title = String(options.title || "").trim();
    const descriptions = Array.isArray(options.descriptions)
      ? options.descriptions.filter((entry) => String(entry || "").trim())
      : [options.description].filter((entry) => String(entry || "").trim());
    const titleY = bounds.y + 30;
    const descriptionY = bounds.y + 62;
    const lineHeight = 24;

    context.save();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = this.themeColor("primary", "#ffffff");
    context.font = "600 22px sans-serif";
    context.fillText(title, bounds.x + 20, titleY);

    context.fillStyle = this.themeColor("secondary", "#aebbd0");
    context.font = "14px sans-serif";
    descriptions.forEach((description, index) => {
      context.fillText(
        String(description),
        bounds.x + 20,
        descriptionY + index * lineHeight,
      );
    });
    context.restore();

    return { titleY, descriptionY, lineHeight };
  }

  static split(bounds, ratio, options = {}) {
    const gap = Number(options.gap) || 8;
    const minimumLeft = Math.max(0, Number(options.minimumLeft) || 0);
    const maximumLeft = Math.max(minimumLeft, Number(options.maximumLeft) || bounds.width);
    const requested = Math.floor((bounds.width - gap) * ratio);
    const leftWidth = Math.max(minimumLeft, Math.min(maximumLeft, requested));

    return {
      left: {
        x: bounds.x,
        y: bounds.y,
        width: leftWidth,
        height: bounds.height,
      },
      right: {
        x: bounds.x + leftWidth + gap,
        y: bounds.y,
        width: bounds.width - leftWidth - gap,
        height: bounds.height,
      },
    };
  }
}
