"use strict";

class AudioManager {
  static initialize() {
    this.database = { bgm: {}, se: {} };
    this.currentBgm = null;
    this.fadingBgm = [];
    this.activeSe = new Map();
    this.failedAssets = new Set();
    this.pendingBgmRetry = false;
    this.lastBgmPlayError = null;
    this.userInteracted = false;
    this.initialized = true;

    if (typeof window !== "undefined" && window?.addEventListener) {
      const unlock = () => this.unlock();
      window.addEventListener("keydown", unlock, { passive: true });
      window.addEventListener("pointerdown", unlock, { passive: true });
    }

    DebugManager.log("AudioManager initialized.");
  }

  static configure(database) {
    this.ensureInitialized();
    this.database = database && typeof database === "object"
      ? {
          bgm: database.bgm && typeof database.bgm === "object" ? database.bgm : {},
          se: database.se && typeof database.se === "object" ? database.se : {},
        }
      : { bgm: {}, se: {} };
    this.refreshVolumes();
    return this.database;
  }

  static ensureInitialized() {
    if (!this.initialized) {
      this.initialize();
    }
  }

  static clamp01(value, fallback = 1) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  }

  static definition(channel, key) {
    this.ensureInitialized();
    const normalized = typeof key === "string" ? key.trim() : "";
    if (!normalized || !["bgm", "se"].includes(channel)) {
      return null;
    }
    return this.database?.[channel]?.[normalized] || null;
  }

  static volumeRate(key, fallback = 1) {
    if (
      typeof ConfigManager === "undefined" ||
      typeof ConfigManager.audioVolumeRate !== "function"
    ) {
      return fallback;
    }
    return ConfigManager.audioVolumeRate(key);
  }

  static targetVolume(channel, definition) {
    const master = this.volumeRate("masterVolume", 1);
    const channelRate = this.volumeRate(
      channel === "bgm" ? "bgmVolume" : "seVolume",
      1,
    );
    const assetRate = this.clamp01(definition?.volume, 1);
    return this.clamp01(master * channelRate * assetRate, 1);
  }

  static createAudio(definition, { loop = false } = {}) {
    if (typeof Audio !== "function" || !definition?.file) {
      return null;
    }

    const audio = new Audio(definition.file);
    audio.preload = "auto";
    audio.loop = definition.loop === undefined ? loop : definition.loop === true;
    return audio;
  }

  static attachFailureHandler(audio, channel, key, definition) {
    if (!audio?.addEventListener) {
      return;
    }

    audio.addEventListener("error", () => {
      const failureKey = `${channel}:${key}`;
      if (this.failedAssets.has(failureKey)) {
        return;
      }
      this.failedAssets.add(failureKey);
      console.warn(
        `Failed to load ${channel.toUpperCase()} '${key}': ${definition?.file || "unknown asset"}`,
      );
    });
  }

  static expectedPlaybackBlock(error) {
    return error?.name === "NotAllowedError" || error?.name === "AbortError";
  }

  static noteBgmPlaybackFailure(audio, error) {
    if (this.currentBgm?.audio !== audio) {
      return;
    }

    this.pendingBgmRetry = true;
    this.lastBgmPlayError = error?.name || "PlaybackError";

    if (!this.expectedPlaybackBlock(error)) {
      console.warn("Audio playback failed.", error);
    }
  }

  static attemptPlay(audio) {
    if (!audio?.play) {
      return false;
    }

    try {
      const result = audio.play();
      if (result?.then) {
        result
          .then(() => {
            if (this.currentBgm?.audio === audio) {
              this.pendingBgmRetry = false;
              this.lastBgmPlayError = null;
            }
          })
          .catch((error) => this.noteBgmPlaybackFailure(audio, error));
      } else if (this.currentBgm?.audio === audio) {
        this.pendingBgmRetry = false;
        this.lastBgmPlayError = null;
      }
      return true;
    } catch (error) {
      this.noteBgmPlaybackFailure(audio, error);
      return false;
    }
  }

  static unlock() {
    this.ensureInitialized();
    this.userInteracted = true;
    const audio = this.currentBgm?.audio || null;
    if (audio && (audio.paused === true || this.pendingBgmRetry)) {
      this.attemptPlay(audio);
    }
    return true;
  }

  static playBgm(key, { fadeSeconds = 0.35, restart = false } = {}) {
    this.ensureInitialized();
    const definition = this.definition("bgm", key);

    if (!definition) {
      console.warn(`Unknown BGM key '${key}'.`);
      return false;
    }

    if (this.currentBgm?.key === key && restart !== true) {
      this.currentBgm.targetVolume = this.targetVolume("bgm", definition);
      this.attemptPlay(this.currentBgm.audio);
      return true;
    }

    const audio = this.createAudio(definition, { loop: true });
    if (!audio) {
      return false;
    }

    this.attachFailureHandler(audio, "bgm", key, definition);
    const duration = Math.max(0, Number(fadeSeconds) || 0);
    const targetVolume = this.targetVolume("bgm", definition);
    const previous = this.currentBgm;

    if (previous?.audio) {
      this.fadingBgm.push({
        ...previous,
        fadeElapsed: 0,
        fadeDuration: duration,
        fadeFrom: Number(previous.audio.volume) || 0,
      });
    }

    audio.volume = duration > 0 ? 0 : targetVolume;
    this.currentBgm = {
      key,
      definition,
      audio,
      targetVolume,
      fadeElapsed: 0,
      fadeDuration: duration,
    };
    this.pendingBgmRetry = true;
    this.lastBgmPlayError = null;
    audio.addEventListener?.("canplay", () => {
      if (
        this.currentBgm?.audio === audio &&
        this.userInteracted &&
        this.pendingBgmRetry
      ) {
        this.attemptPlay(audio);
      }
    });

    // Do not deliberately trip browser autoplay policy during startup. The
    // desired BGM is armed immediately, but its first play() call waits for
    // a real keyboard/pointer gesture. This keeps Firefox/Chromium consoles
    // clean and makes the first user interaction the deterministic unlock.
    if (this.userInteracted) {
      this.attemptPlay(audio);
    }
    return true;
  }

  static stopBgm({ fadeSeconds = 0.35 } = {}) {
    this.ensureInitialized();
    if (!this.currentBgm?.audio) {
      return false;
    }

    const duration = Math.max(0, Number(fadeSeconds) || 0);
    const current = this.currentBgm;
    this.currentBgm = null;
    this.pendingBgmRetry = false;
    this.lastBgmPlayError = null;

    if (duration <= 0) {
      current.audio.pause?.();
      current.audio.currentTime = 0;
      return true;
    }

    this.fadingBgm.push({
      ...current,
      fadeElapsed: 0,
      fadeDuration: duration,
      fadeFrom: Number(current.audio.volume) || 0,
    });
    return true;
  }

  static playSe(key, { volume = 1 } = {}) {
    this.ensureInitialized();
    const definition = this.definition("se", key);

    if (!definition) {
      console.warn(`Unknown SE key '${key}'.`);
      return false;
    }

    const audio = this.createAudio(definition, { loop: false });
    if (!audio) {
      return false;
    }

    this.attachFailureHandler(audio, "se", key, definition);
    audio.loop = false;
    audio.volume = this.clamp01(
      this.targetVolume("se", definition) * this.clamp01(volume, 1),
      1,
    );
    const cleanup = () => this.activeSe.delete(audio);
    audio.addEventListener?.("ended", cleanup, { once: true });
    audio.addEventListener?.("error", cleanup, { once: true });
    this.activeSe.set(audio, {
      definition,
      volumeScale: this.clamp01(volume, 1),
    });

    if (!this.attemptPlay(audio)) {
      this.activeSe.delete(audio);
      return false;
    }
    return true;
  }

  static refreshVolumes() {
    this.ensureInitialized();

    if (this.currentBgm?.audio) {
      this.currentBgm.targetVolume = this.targetVolume(
        "bgm",
        this.currentBgm.definition,
      );
      if ((Number(this.currentBgm.fadeDuration) || 0) <= 0) {
        this.currentBgm.audio.volume = this.currentBgm.targetVolume;
      }
    }

    for (const [audio, state] of this.activeSe || []) {
      if (state?.definition) {
        audio.volume = this.clamp01(
          this.targetVolume("se", state.definition) *
            this.clamp01(state.volumeScale, 1),
          1,
        );
      }
    }

    return true;
  }

  static update(deltaTime) {
    this.ensureInitialized();
    const elapsed = Math.max(0, Number(deltaTime) || 0);

    if (this.currentBgm?.audio) {
      const state = this.currentBgm;
      const duration = Math.max(0, Number(state.fadeDuration) || 0);
      state.targetVolume = this.targetVolume("bgm", state.definition);

      if (duration <= 0) {
        state.audio.volume = state.targetVolume;
      } else {
        state.fadeElapsed = Math.min(duration, (Number(state.fadeElapsed) || 0) + elapsed);
        const rate = duration > 0 ? state.fadeElapsed / duration : 1;
        state.audio.volume = this.clamp01(state.targetVolume * rate, state.targetVolume);
        if (rate >= 1) {
          state.fadeDuration = 0;
        }
      }
    }

    const survivors = [];
    for (const state of this.fadingBgm || []) {
      const duration = Math.max(0, Number(state.fadeDuration) || 0);
      state.fadeElapsed = Math.min(duration, (Number(state.fadeElapsed) || 0) + elapsed);
      const rate = duration > 0 ? state.fadeElapsed / duration : 1;
      state.audio.volume = this.clamp01((Number(state.fadeFrom) || 0) * (1 - rate), 0);

      if (rate >= 1) {
        state.audio.pause?.();
        state.audio.currentTime = 0;
      } else {
        survivors.push(state);
      }
    }
    this.fadingBgm = survivors;
    return true;
  }

  static currentBgmKey() {
    return this.currentBgm?.key || null;
  }

  static summary() {
    this.ensureInitialized();
    return {
      bgmKeys: Object.keys(this.database?.bgm || {}),
      seKeys: Object.keys(this.database?.se || {}),
      currentBgmKey: this.currentBgmKey(),
      userInteracted: this.userInteracted === true,
      bgmPlayback: this.currentBgm?.audio
        ? {
            paused: this.currentBgm.audio.paused === true,
            readyState: Number(this.currentBgm.audio.readyState) || 0,
            networkState: Number(this.currentBgm.audio.networkState) || 0,
            volume: Number(this.currentBgm.audio.volume) || 0,
            pendingRetry: this.pendingBgmRetry === true,
            lastError: this.lastBgmPlayError,
          }
        : null,
      failedAssets: [...this.failedAssets],
    };
  }
}
