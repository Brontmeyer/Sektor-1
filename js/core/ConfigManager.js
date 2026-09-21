"use strict";

class ConfigManager {
  static currentVersion() {
    return 1;
  }

  static storageKey() {
    return "Sektor1_Config_v1";
  }

  static defaults() {
    return {
      battleSpeed: "normal",
      battleMessageSpeed: "normal",
      fieldMessageSpeed: "normal",
      battleCursorMemory: "initial",
      magickOrder: "default",
    };
  }

  static optionDefinitions() {
    return [
      {
        key: "battleSpeed",
        label: "Battle Speed",
        values: ["slow", "normal", "fast"],
        labels: { slow: "Slow", normal: "Normal", fast: "Fast" },
        description: "Changes battle animation and action pacing.",
      },
      {
        key: "battleMessageSpeed",
        label: "Battle Message Speed",
        values: ["slow", "normal", "fast"],
        labels: { slow: "Slow", normal: "Normal", fast: "Fast" },
        description: "Changes how long temporary battle banners remain visible.",
      },
      {
        key: "fieldMessageSpeed",
        label: "Field Message Speed",
        values: ["slow", "normal", "fast"],
        labels: { slow: "Slow", normal: "Normal", fast: "Fast" },
        description: "Changes field dialogue reveal speed.",
      },
      {
        key: "battleCursorMemory",
        label: "Battle Cursor",
        values: ["initial", "memory"],
        labels: { initial: "Initial", memory: "Memory" },
        description: "Initial resets battle lists; Memory keeps the last cursor this battle.",
      },
      {
        key: "magickOrder",
        label: "Magick Order",
        values: ["default", "alphabetical", "element"],
        labels: {
          default: "Default",
          alphabetical: "Alphabetical",
          element: "Element",
        },
        description: "Changes how learned Magick is presented in menus and battle.",
      },
    ];
  }

  static initialize() {
    this.data = this.defaults();
    this.lastError = "";
    this.load();
  }

  static ensureInitialized() {
    if (!this.data) {
      this.initialize();
    }
  }

  static definition(key) {
    return this.optionDefinitions().find((option) => option.key === key) || null;
  }

  static sanitize(source) {
    const result = this.defaults();

    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return result;
    }

    for (const option of this.optionDefinitions()) {
      if (option.values.includes(source[option.key])) {
        result[option.key] = source[option.key];
      }
    }

    return result;
  }

  static load() {
    this.ensureInitializedWithoutLoad();

    try {
      const json = localStorage.getItem(this.storageKey());

      if (!json) {
        return false;
      }

      const parsed = JSON.parse(json);
      const payload =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed.options || parsed
          : null;

      this.data = this.sanitize(payload);
      return true;
    } catch (error) {
      this.lastError = "Could not load configuration; defaults were restored.";
      console.warn(this.lastError, error);
      this.data = this.defaults();
      return false;
    }
  }

  static ensureInitializedWithoutLoad() {
    if (!this.data) {
      this.data = this.defaults();
    }
  }

  static save() {
    this.ensureInitializedWithoutLoad();

    try {
      const payload = {
        version: this.currentVersion(),
        options: { ...this.data },
      };
      localStorage.setItem(this.storageKey(), JSON.stringify(payload));
      this.lastError = "";
      return true;
    } catch (error) {
      this.lastError = "Could not save configuration.";
      console.warn(this.lastError, error);
      return false;
    }
  }

  static get(key) {
    this.ensureInitializedWithoutLoad();
    return this.data[key];
  }

  static set(key, value, { persist = true } = {}) {
    this.ensureInitializedWithoutLoad();
    const option = this.definition(key);

    if (!option || !option.values.includes(value)) {
      return false;
    }

    this.data[key] = value;

    if (persist) {
      this.save();
    }

    return true;
  }

  static cycle(key, direction = 1) {
    const option = this.definition(key);

    if (!option) {
      return null;
    }

    const current = this.get(key);
    const currentIndex = Math.max(0, option.values.indexOf(current));
    const offset = Number(direction) < 0 ? -1 : 1;
    const nextIndex =
      (currentIndex + offset + option.values.length) % option.values.length;
    const value = option.values[nextIndex];

    this.set(key, value);
    return value;
  }

  static reset() {
    this.data = this.defaults();
    this.save();
    return { ...this.data };
  }

  static displayValue(key) {
    const option = this.definition(key);
    const value = this.get(key);
    return option?.labels?.[value] || String(value ?? "");
  }

  static battleSpeedMultiplier() {
    return {
      slow: 0.75,
      normal: 1,
      fast: 1.35,
    }[this.get("battleSpeed")] || 1;
  }

  static battleMessageSpeedMultiplier() {
    return {
      slow: 0.7,
      normal: 1,
      fast: 1.45,
    }[this.get("battleMessageSpeed")] || 1;
  }

  static fieldMessageCharactersPerSecond() {
    return {
      slow: 24,
      normal: 42,
      fast: 70,
    }[this.get("fieldMessageSpeed")] || 42;
  }

  static battleDeltaTime(deltaTime) {
    return Math.max(0, Number(deltaTime) || 0) * this.battleSpeedMultiplier();
  }

  static battleMessageDeltaTime(deltaTime) {
    return (
      Math.max(0, Number(deltaTime) || 0) *
      this.battleMessageSpeedMultiplier()
    );
  }

  static battleCursorMemoryEnabled() {
    return this.get("battleCursorMemory") === "memory";
  }

  static sortMagick(list) {
    const source = Array.isArray(list) ? [...list] : [];
    const order = this.get("magickOrder");

    if (order === "alphabetical") {
      return source.sort((a, b) => {
        const nameA = String(a?.name || "").toLowerCase();
        const nameB = String(b?.name || "").toLowerCase();

        if (nameA < nameB) {
          return -1;
        }

        if (nameA > nameB) {
          return 1;
        }

        return (Number(a?.id) || 0) - (Number(b?.id) || 0);
      });
    }

    if (order === "element") {
      const elementOrder = [
        "restorative",
        "fire",
        "ice",
        "lightning",
        "earth",
        "wind",
        "poison",
        "gravity",
        "none",
      ];

      return source.sort((a, b) => {
        const elementA = String(a?.element || "none").toLowerCase();
        const elementB = String(b?.element || "none").toLowerCase();
        const rawIndexA = elementOrder.indexOf(elementA);
        const rawIndexB = elementOrder.indexOf(elementB);
        const indexA = rawIndexA >= 0 ? rawIndexA : elementOrder.length;
        const indexB = rawIndexB >= 0 ? rawIndexB : elementOrder.length;

        if (indexA !== indexB) {
          return indexA - indexB;
        }

        if (elementA < elementB) {
          return -1;
        }

        if (elementA > elementB) {
          return 1;
        }

        return (Number(a?.id) || 0) - (Number(b?.id) || 0);
      });
    }

    return source;
  }
}
