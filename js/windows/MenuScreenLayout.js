"use strict";

class MenuScreenLayout {
  static metrics(width = Graphics.width, height = Graphics.height) {
    const safeWidth = Math.max(640, Number(width) || 640);
    const safeHeight = Math.max(480, Number(height) || 480);
    const margin = Math.max(8, Math.min(14, Math.floor(safeWidth * 0.01)));
    const gap = 8;
    const headerHeight = 70;

    return {
      x: margin,
      y: margin,
      width: safeWidth - margin * 2,
      height: safeHeight - margin * 2,
      margin,
      gap,
      headerHeight,
      right: safeWidth - margin,
      bottom: safeHeight - margin,
    };
  }

  static drawBackdrop(context, width = Graphics.width, height = Graphics.height) {
    if (!context) {
      return false;
    }

    const backdrop =
      typeof UIThemePalette !== "undefined" &&
      typeof UIThemePalette.backdrop === "function"
        ? UIThemePalette.backdrop()
        : "#0b0e13";

    context.fillStyle = backdrop;
    context.fillRect(0, 0, width, height);

    if (typeof context.createLinearGradient !== "function") {
      return true;
    }

    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "rgba(46, 52, 62, 0.2)");
    gradient.addColorStop(0.5, "rgba(11, 14, 19, 0)");
    gradient.addColorStop(1, "rgba(35, 39, 48, 0.14)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return true;
  }

  static headerBody(options = {}) {
    const metrics = this.metrics(options.width, options.height);
    const headerHeight = Math.max(
      1,
      Number(options.headerHeight) || metrics.headerHeight,
    );
    const gap = Math.max(0, Number(options.gap) || metrics.gap);
    const bodyY = metrics.y + headerHeight + gap;

    return {
      ...metrics,
      gap,
      headerHeight,
      headerBounds: {
        x: metrics.x,
        y: metrics.y,
        width: metrics.width,
        height: headerHeight,
      },
      bodyBounds: {
        x: metrics.x,
        y: bodyY,
        width: metrics.width,
        height: Math.max(0, metrics.bottom - bodyY),
      },
    };
  }
}
