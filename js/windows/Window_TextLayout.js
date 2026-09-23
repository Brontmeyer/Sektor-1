"use strict";

class Window_TextLayout {
  static wrapLines(context, text, maxWidth) {
    const lines = [];
    const paragraphs = String(text || "").split("\n");

    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);

      if (words.length === 0) {
        lines.push("");
        continue;
      }

      let line = "";

      for (const word of words) {
        const next = line ? `${line} ${word}` : word;

        if (line && context.measureText(next).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }

      if (line) {
        lines.push(line);
      }
    }

    return lines;
  }

  static ellipsize(context, text, maxWidth) {
    let value = String(text || "").trimEnd();
    const suffix = "…";

    if (context.measureText(`${value}${suffix}`).width <= maxWidth) {
      return `${value}${suffix}`;
    }

    while (
      value.length > 0 &&
      context.measureText(`${value}${suffix}`).width > maxWidth
    ) {
      value = value.slice(0, -1).trimEnd();
    }

    return value ? `${value}${suffix}` : suffix;
  }

  static preparedLines(context, text, maxWidth, maxLines = Infinity) {
    const lines = this.wrapLines(context, text, maxWidth);
    const lineLimit = Number.isFinite(maxLines)
      ? Math.max(0, Math.floor(maxLines))
      : lines.length;
    const visibleLines = lines.slice(0, lineLimit);
    const truncated = lines.length > visibleLines.length;

    if (truncated && visibleLines.length > 0) {
      const lastIndex = visibleLines.length - 1;
      visibleLines[lastIndex] = this.ellipsize(
        context,
        visibleLines[lastIndex],
        maxWidth,
      );
    }

    return { lines, visibleLines, truncated };
  }

  static drawWrappedText(
    context,
    text,
    x,
    y,
    maxWidth,
    lineHeight,
    maxLines = Infinity,
  ) {
    const layout = this.preparedLines(context, text, maxWidth, maxLines);

    for (let i = 0; i < layout.visibleLines.length; i++) {
      context.fillText(layout.visibleLines[i], x, y + i * lineHeight);
    }

    return {
      lineCount: layout.lines.length,
      drawnLineCount: layout.visibleLines.length,
      truncated: layout.truncated,
      nextY: y + layout.visibleLines.length * lineHeight,
    };
  }

  static drawWrappedTextCentered(
    context,
    text,
    x,
    centerY,
    maxWidth,
    lineHeight,
    maxLines = Infinity,
  ) {
    const layout = this.preparedLines(context, text, maxWidth, maxLines);
    const firstY =
      centerY - ((Math.max(1, layout.visibleLines.length) - 1) * lineHeight) / 2;

    for (let i = 0; i < layout.visibleLines.length; i++) {
      context.fillText(layout.visibleLines[i], x, firstY + i * lineHeight);
    }

    return {
      lineCount: layout.lines.length,
      drawnLineCount: layout.visibleLines.length,
      truncated: layout.truncated,
      firstY,
      nextY: firstY + layout.visibleLines.length * lineHeight,
    };
  }
}
