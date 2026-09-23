"use strict";

class CharacterMenuLayout {
  static calculate(options = {}) {
    const margin = Math.max(12, Math.min(22, Math.floor(Graphics.width * 0.014)));
    const gap = 8;
    const width = Graphics.width - margin * 2;
    const height = Graphics.height - margin * 2;
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
