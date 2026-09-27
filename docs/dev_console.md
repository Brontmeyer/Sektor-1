# 🧰 Sektor 1 Development Console

`$dev` is a development-only console facade for setting up live runtime state quickly. It is installed only when `data/System.json` has `debugMode: true`. It does not rewrite canonical JSON data.

## Quick start

Open the browser developer console and type:

```js
const D = $dev;
D.help();
```

Useful short accessors:

```js
D.P       // current Game_Party
D.S       // current Game_System
D.A(1)    // actor ID 1
D.E(0)    // enemy index 0 in the active battle
```

## Common setup

```js
D.recruitAll();          // recruit every current actor
D.full();                // heal/restore/clear statuses for the recruited party
D.hp(1, 125);            // actor 1 -> 125 HP
D.hpRate(1, 0.25);       // actor 1 -> 25% Max HP
D.mp(1, 20);             // actor 1 -> 20 MP
D.valor(1);              // actor 1 -> full Valor
D.valor(1, 50);          // actor 1 -> 50 Valor
D.status(1, "poison");   // apply a status by stable key
D.clearStatus(1, "poison");
D.statusChance(1, "sleep", 0.72); // inspect effective chance after resistance
D.verbose(true);         // opt into low-level HP/MP/runtime tracing
D.verbose(false);        // return to concise action-level console output
D.item(1, 10);           // gain 10 of item ID 1
D.gil(10000);            // gain 10,000 Runes
D.battle(1);             // start encounter ID 1
```

By default, routine model-layer HP/MP/Magick bookkeeping stays quiet so battle actions appear once as resolved action/result lines. Turn on `D.verbose(true)` only when you need to inspect those lower-level resource mutations.

Reference tables are available directly in the console:

```js
D.passives();
D.statuses();
D.encounters();
```

## Essence setup

All Essence helpers use stable Essence IDs. Actor ID defaults to `1` and slot defaults to `0`.

```js
D.essence(4);             // Essence 4 at 0 Resonance
D.essence(4, 1, 0, 300); // Essence 4, actor 1, slot 0, 300 Resonance
D.essenceLevel(4, 3);     // Essence 4 at its Level-3 threshold
D.level4(4);              // Essence 4 at its Level-4 threshold
D.master(4);              // Essence 4 at Mastery-ready Resonance
D.passive(4);             // Level 4 + a mechanic-specific test hint
```

## Level-4 passive IDs

| ID | Current display name | Passive test focus |
|---:|---|---|
| 1 | Healing Essence | Essence-Magick MP reduction |
| 2 | Purity Essence | Cleanse also heals |
| 3 | Renewal Essence | Revive grants Regen |
| 4 | Flame Essence | Fire Magick damage boost |
| 5 | Ice Essence | Ice Magick can inflict Slow |
| 6 | Lightning Essence | Lightning Magick can inflict Paralyze |
| 7 | Earth Essence | Earth Magick can grant Barrier |
| 8 | Poison Essence | Stronger Poison tick damage |
| 9 | Gravity Essence | Gravity Magick can grant Haste |
| 10 | Mind Essence | Mental-family status resistance |
| 11 | Metamorph Essence | Essence status-Magick chance boost |
| 12 | Time Essence | Chance to refund full MP cost |
| 13 | Ward Essence | Critical-HP Barrier + MBarrier once per battle |
| 14 | Null Essence | Chance to negate hostile negative status |
| 15 | Astral Essence | Chance to refund half the paid MP |
| 16 | Wind Essence | Physical evasion bonus |
| 17 | Fury Essence | Low-HP physical damage boost |
| 18 | Wayfarer Essence | Successful-escape party recovery |
| 19 | Rift Essence | Banish chain chance |

Display names in this table are for human reference only. Runtime setup uses the numeric IDs.

## Handy Pass 117 recipes

### Mind resistance diagnostic

```js
const D = $dev;
D.passive(10);
D.statusChance(1, "sleep", 0.72);
// Level-4 Mind reports a 75% target rate and 54% effective chance.
```

`statusChance()` is deterministic inspection only. It does not apply the status or consume a random roll, and it intentionally reports the resistance-adjusted application chance before separate negation mechanics such as Null Essence.

### Ward threshold

```js
const D = $dev;
D.passive(13);
D.hpRate(1, 0.26);
D.battle(1);
// Let Tyler take enough damage to cross <=25% HP.
```

### Fury tiers

```js
const D = $dev;
D.passive(17);
D.hpRate(1, 1.00); // baseline
D.battle(1);
// Compare physical damage again at 0.50 and 0.25 HP rate.
```

### Wayfarer escape recovery

```js
const D = $dev;
D.recruitAll();
D.full();
for (const actor of D.P.members()) {
  D.hpRate(actor.actorId, 0.50);
  D.mp(actor.actorId, Math.floor(actor.maxMp * 0.50));
}
D.passive(18);
D.battle(1); // escapable encounter
// Escape successfully and inspect party HP/MP.
```

### Rift chaining

```js
const D = $dev;
D.passive(19);
D.battle(5); // multi-enemy encounter
// Cast Banish repeatedly; the passive is chance-based.
```

Chance-based passives are intentionally still random in normal play. Repeat the relevant action enough times to observe them rather than treating one failed roll as a broken passive.
