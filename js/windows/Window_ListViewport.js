"use strict";

class Window_ListViewport {
  constructor(maxVisibleRows) {
    const rows = Number(maxVisibleRows);

    if (!Number.isInteger(rows) || rows <= 0) {
      throw new Error("Window_ListViewport requires a positive row count.");
    }

    this.maxVisibleRows = rows;
    this.offset = 0;
  }

  reset(index = 0, totalEntries = 0) {
    this.offset = 0;
    this.ensureVisible(index, totalEntries);
  }

  ensureVisible(index, totalEntries) {
    const total = this.normalizeTotal(totalEntries);

    if (total === 0) {
      this.offset = 0;
      return;
    }

    const selectedIndex = Math.max(
      0,
      Math.min(this.normalizeIndex(index), total - 1),
    );

    if (selectedIndex < this.offset) {
      this.offset = selectedIndex;
    } else if (selectedIndex >= this.offset + this.maxVisibleRows) {
      this.offset = selectedIndex - this.maxVisibleRows + 1;
    }

    const maxOffset = Math.max(0, total - this.maxVisibleRows);
    this.offset = Math.max(0, Math.min(this.offset, maxOffset));
  }

  visibleRange(index, totalEntries) {
    const total = this.normalizeTotal(totalEntries);

    this.ensureVisible(index, total);

    return {
      start: this.offset,
      end: Math.min(total, this.offset + this.maxVisibleRows),
    };
  }

  pageSelection(index, direction, totalEntries) {
    const total = this.normalizeTotal(totalEntries);

    if (total === 0) {
      this.offset = 0;
      return 0;
    }

    const current = Math.max(0, Math.min(this.normalizeIndex(index), total - 1));
    const step = Math.max(1, this.maxVisibleRows);
    const delta = Number(direction) < 0 ? -step : step;
    const next = Math.max(0, Math.min(total - 1, current + delta));

    this.ensureVisible(next, total);
    return next;
  }

  hasPrevious() {
    return this.offset > 0;
  }

  hasNext(totalEntries) {
    const total = this.normalizeTotal(totalEntries);

    return this.offset + this.maxVisibleRows < total;
  }

  normalizeIndex(index) {
    const value = Number(index);

    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.trunc(value));
  }

  normalizeTotal(totalEntries) {
    const value = Number(totalEntries);

    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.trunc(value));
  }
}
