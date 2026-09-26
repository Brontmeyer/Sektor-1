"use strict";

class MainMenuLayout {
  static calculate(width = Graphics.width, height = Graphics.height) {
    const screen = MenuScreenLayout.metrics(width, height);
    const safeWidth = Math.max(640, Number(width) || 640);
    const safeHeight = Math.max(480, Number(height) || 480);
    const margin = screen.margin;
    const gap = screen.gap;
    const headerHeight = screen.headerHeight;
    const contentY = margin + headerHeight + gap;
    const contentBottom = screen.bottom;
    const contentHeight = Math.max(300, contentBottom - contentY);
    const rightWidth = Math.max(220, Math.min(286, Math.floor(safeWidth * 0.23)));
    const rightX = safeWidth - margin - rightWidth;
    const leftWidth = Math.max(360, rightX - gap - margin);
    const utilityHeight = 72;
    const locationHeight = 62;
    const utilityGap = gap;
    const commandHeight = Math.max(
      330,
      contentHeight - utilityHeight - locationHeight - utilityGap * 2,
    );

    return {
      header: {
        x: margin,
        y: margin,
        width: safeWidth - margin * 2,
        height: headerHeight,
      },
      party: {
        x: margin,
        y: contentY,
        width: leftWidth,
        height: contentHeight,
      },
      commands: {
        x: rightX,
        y: contentY,
        width: rightWidth,
        height: commandHeight,
      },
      utility: {
        x: rightX,
        y: contentY + commandHeight + utilityGap,
        width: rightWidth,
        height: utilityHeight,
      },
      location: {
        x: rightX,
        y: contentY + commandHeight + utilityGap + utilityHeight + utilityGap,
        width: rightWidth,
        height: locationHeight,
      },
    };
  }
}
