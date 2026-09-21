"use strict";

class ConfigManager {
  static currentVersion() {
    return 2;
  }

  static storageKey() {
    return "Sektor1_Config_v2";
  }

  static legacyStorageKeys() {
    return ["Sektor1_Config_v1"];
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

  static controlDefinitions() {
    return [
      { action: "up", label: "Up", defaults: ["KeyW", "ArrowUp"], required: true },
      { action: "down", label: "Down", defaults: ["KeyS", "ArrowDown"], required: true },
      { action: "left", label: "Left", defaults: ["KeyA", "ArrowLeft"], required: true },
      { action: "right", label: "Right", defaults: ["KeyD", "ArrowRight"], required: true },
      { action: "confirm", label: "Confirm", defaults: ["KeyE", "Enter"], required: true },
      { action: "cancel", label: "Cancel / Back", defaults: ["KeyQ", "Escape"], required: true },
      { action: "menu", label: "Menu", defaults: ["Escape", null], required: true },
      { action: "interact", label: "Interact", defaults: ["KeyE", null], required: true },
      { action: "help", label: "Tactical Help", defaults: ["KeyH", null], required: false },
      { action: "scope", label: "Target Scope", defaults: ["KeyR", null], required: false },
    ];
  }

  static defaultBindings() {
    return Object.fromEntries(
      this.controlDefinitions().map((definition) => [
        definition.action,
        [...definition.defaults],
      ]),
    );
  }

  static initialize() {
    this.data = this.defaults();
    this.bindings = this.defaultBindings();
    this.lastError = "";
    this.load();
  }

  static ensureInitialized() {
    if (!this.data || !this.bindings) {
      this.initialize();
    }
  }

  static ensureInitializedWithoutLoad() {
    if (!this.data) {
      this.data = this.defaults();
    }

    if (!this.bindings) {
      this.bindings = this.defaultBindings();
    }
  }

  static definition(key) {
    return this.optionDefinitions().find((option) => option.key === key) || null;
  }

  static controlDefinition(action) {
    return (
      this.controlDefinitions().find(
        (definition) => definition.action === action,
      ) || null
    );
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

  static isBindingCode(code) {
    return typeof code === "string" && /^[A-Za-z0-9]+$/.test(code);
  }

  static sanitizeBindings(source) {
    const result = this.defaultBindings();

    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return result;
    }

    for (const definition of this.controlDefinitions()) {
      const incoming = source[definition.action];

      if (!Array.isArray(incoming)) {
        continue;
      }

      const slots = [0, 1].map((slot) => {
        const value = incoming[slot];
        return this.isBindingCode(value) ? value : null;
      });

      if (definition.required && slots.every((value) => value === null)) {
        continue;
      }

      if (slots[0] && slots[1] && slots[0] === slots[1]) {
        slots[1] = null;
      }

      result[definition.action] = slots;
    }

    return result;
  }

  static readStoredPayload() {
    const keys = [this.storageKey(), ...this.legacyStorageKeys()];

    for (const key of keys) {
      const json = localStorage.getItem(key);

      if (!json) {
        continue;
      }

      return { key, parsed: JSON.parse(json) };
    }

    return null;
  }

  static load() {
    this.ensureInitializedWithoutLoad();

    try {
      const stored = this.readStoredPayload();

      if (!stored) {
        return false;
      }

      const parsed = stored.parsed;
      const payload =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed.options || parsed
          : null;

      this.data = this.sanitize(payload);
      this.bindings = this.sanitizeBindings(parsed?.bindings);

      if (stored.key !== this.storageKey()) {
        this.save();
      }

      return true;
    } catch (error) {
      this.lastError = "Could not load configuration; defaults were restored.";
      console.warn(this.lastError, error);
      this.data = this.defaults();
      this.bindings = this.defaultBindings();
      return false;
    }
  }

  static save() {
    this.ensureInitializedWithoutLoad();

    try {
      const payload = {
        version: this.currentVersion(),
        options: { ...this.data },
        bindings: Object.fromEntries(
          Object.entries(this.bindings).map(([action, slots]) => [
            action,
            [...slots],
          ]),
        ),
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

  static bindingSlots(action) {
    this.ensureInitializedWithoutLoad();
    return [...(this.bindings[action] || [])];
  }

  static boundCodes(action) {
    return this.bindingSlots(action).filter((code) => typeof code === "string");
  }

  static setBinding(action, slot, code, { persist = true } = {}) {
    this.ensureInitializedWithoutLoad();
    const definition = this.controlDefinition(action);
    const slotIndex = Number(slot);

    if (
      !definition ||
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex > 1 ||
      !this.isBindingCode(code)
    ) {
      return false;
    }

    const slots = this.bindingSlots(action);
    const otherSlot = slotIndex === 0 ? 1 : 0;

    if (slots[otherSlot] === code) {
      slots[otherSlot] = null;
    }

    slots[slotIndex] = code;
    this.bindings[action] = slots;

    if (persist) {
      this.save();
    }

    return true;
  }

  static clearBinding(action, slot, { persist = true } = {}) {
    this.ensureInitializedWithoutLoad();
    const definition = this.controlDefinition(action);
    const slotIndex = Number(slot);

    if (!definition || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 1) {
      return false;
    }

    const slots = this.bindingSlots(action);
    slots[slotIndex] = null;

    if (definition.required && slots.every((code) => code === null)) {
      return false;
    }

    this.bindings[action] = slots;

    if (persist) {
      this.save();
    }

    return true;
  }

  static resetBindings({ persist = true } = {}) {
    this.bindings = this.defaultBindings();

    if (persist) {
      this.save();
    }

    return this.defaultBindings();
  }

  static keyLabel(code) {
    if (!code) {
      return "--";
    }

    const labels = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Enter: "Enter",
      Escape: "Esc",
      Space: "Space",
      Backspace: "Backspace",
      Delete: "Delete",
    };

    if (labels[code]) {
      return labels[code];
    }

    if (/^Key[A-Z]$/.test(code)) {
      return code.slice(3);
    }

    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }

    return code;
  }

  static bindingLabel(action) {
    const labels = this.boundCodes(action).map((code) => this.keyLabel(code));
    return labels.length > 0 ? labels.join(" / ") : "Unbound";
  }

  static displayValue(key) {
    const option = this.definition(key);
    const value = this.get(key);
    return option?.labels?.[value] || String(value ?? "");
  }

  static battleSpeedMultiplier() {
    return { slow: 0.75, normal: 1, fast: 1.35 }[this.get("battleSpeed")] || 1;
  }

  static battleMessageSpeedMultiplier() {
    return { slow: 0.7, normal: 1, fast: 1.45 }[this.get("battleMessageSpeed")] || 1;
  }

  static fieldMessageCharactersPerSecond() {
    return { slow: 24, normal: 42, fast: 70 }[this.get("fieldMessageSpeed")] || 42;
  }

  static battleDeltaTime(deltaTime) {
    return Math.max(0, Number(deltaTime) || 0) * this.battleSpeedMultiplier();
  }

  static battleMessageDeltaTime(deltaTime) {
    return Math.max(0, Number(deltaTime) || 0) * this.battleMessageSpeedMultiplier();
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

        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
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

        if (indexA !== indexB) return indexA - indexB;
        if (elementA < elementB) return -1;
        if (elementA > elementB) return 1;
        return (Number(a?.id) || 0) - (Number(b?.id) || 0);
      });
    }

    return source;
  }
}
