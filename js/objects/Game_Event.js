"use strict";

class Game_Event {
  constructor(eventData) {
    this.id = eventData.id;

    this.name = eventData.name || "";

    this.x = eventData.x || 0;

    this.y = eventData.y || 0;

    this.width = eventData.width || 32;

    this.height = eventData.height || 32;

    this.solid = eventData.solid || false;

    // New event-page system.
    //
    // If an older event still uses
    // "commands" directly, we convert it
    // into one default page automatically.

    if (eventData.pages) {
      this.pages = eventData.pages;
    } else {
      this.pages = [
        {
          conditions: {},
          commands: eventData.commands || [],
        },
      ];
    }

    this.activePageIndex = -1;

    this.activePage = null;

    this.commands = [];

    this.refreshPage();
  }

  update(deltaTime) {
    this.refreshPage();
  }

  refreshPage() {
    const newPageIndex = this.findActivePageIndex();

    if (newPageIndex === this.activePageIndex) {
      return;
    }

    this.activePageIndex = newPageIndex;

    if (this.activePageIndex >= 0) {
      this.activePage = this.pages[this.activePageIndex];

      this.commands = this.activePage.commands || [];
    } else {
      this.activePage = null;

      this.commands = [];
    }

    console.log(
      `Event "${this.name}" changed to page ${this.activePageIndex + 1}`,
    );
  }

  findActivePageIndex() {
    // Check from the last page backwards.
    //
    // This means later pages have
    // higher priority if they satisfy their conditions.

    for (let i = this.pages.length - 1; i >= 0; i--) {
      if (this.pageConditionsMet(this.pages[i])) {
        return i;
      }
    }

    return -1;
  }

  pageConditionsMet(page) {
    const conditions = page.conditions || {};

    // =====================================
    // SWITCH CONDITIONS
    // =====================================

    const switchConditions = conditions.switches || [];

    if (!Array.isArray(switchConditions)) {
      console.error(
        `Event "${this.name}" has invalid "switches". Expected an array.`,
      );

      return false;
    }

    for (const switchCondition of switchConditions) {
      const currentValue = $gameSwitches.value(switchCondition.id);

      const expectedValue = switchCondition.value === true;

      if (currentValue !== expectedValue) {
        return false;
      }
    }

    // =====================================
    // VARIABLE CONDITIONS
    // =====================================

    const variableConditions = conditions.variables || [];

    if (!Array.isArray(variableConditions)) {
      console.error(
        `Event "${this.name}" has invalid "variables". Expected an array.`,
      );

      return false;
    }

    for (const variableCondition of variableConditions) {
      const currentValue = $gameVariables.value(variableCondition.id);

      const targetValue = variableCondition.value;

      const operator = variableCondition.operator || ">=";

      let result = false;

      switch (operator) {
        case "==":
          result = currentValue === targetValue;

          break;

        case "!=":
          result = currentValue !== targetValue;

          break;

        case ">":
          result = currentValue > targetValue;

          break;

        case ">=":
          result = currentValue >= targetValue;

          break;

        case "<":
          result = currentValue < targetValue;

          break;

        case "<=":
          result = currentValue <= targetValue;

          break;

        default:
          console.error(
            `Event "${this.name}" has unknown variable operator "${operator}".`,
          );

          return false;
      }

      if (!result) {
        return false;
      }
    }

    return true;
  }
  draw(cameraX, cameraY) {
    if (!this.activePage) {
      return;
    }

    const context = Graphics.context;

    context.fillStyle = "#e0b040";

    context.fillRect(
      this.x - cameraX,
      this.y - cameraY,
      this.width,
      this.height,
    );
  }
}
