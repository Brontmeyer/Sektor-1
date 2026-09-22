"use strict";

class MainMenuLayout {
  static calculate(width = Graphics.width, height = Graphics.height) {
    const safeWidth = Math.max(640, Number(width) || 640);
    const safeHeight = Math.max(480, Number(height) || 480);
    const margin = Math.max(18, Math.min(28, Math.floor(safeWidth * 0.018)));
    const gap = Math.max(12, Math.min(18, Math.floor(safeWidth * 0.012)));
    const headerHeight = 48;
    const contentY = margin + headerHeight + 12;
    const contentBottom = safeHeight - margin;
    const contentHeight = Math.max(300, contentBottom - contentY);
    const rightWidth = Math.max(220, Math.min(286, Math.floor(safeWidth * 0.23)));
    const rightX = safeWidth - margin - rightWidth;
    const leftWidth = Math.max(360, rightX - gap - margin);
    const utilityHeight = 72;
    const locationHeight = 62;
    const utilityGap = 10;
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
