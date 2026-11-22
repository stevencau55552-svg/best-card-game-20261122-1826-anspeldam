# Ember Sigil Duel

[![Bounty: Make the best card game](https://img.shields.io/badge/bounty-best--card--game--20261122--1826-gold)](https://make.fun/bounty/best-card-game-20261122-1826)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: Playable offline](https://img.shields.io/badge/status-playable%20offline-brightgreen)](game/index.html)

An original turn-based card duel of four elements, played offline in a desktop browser from static files. No build step, no network requests, no libraries.

## The duel

You are **Asha, the Ember Warden**. Your opponent is **Vex, the Cinder Imp**. Both heroes start at 30 life.

- Each turn you draw a card and gain mana (1 → 10).
- Click a card in your hand to play it. Creatures take the table; spells need a target — click the spell, then its target.
- At the end of every round, creatures strike: each one hits the creature opposite it, or the hero if that slot is empty.
- Elements matter: **◆ Ember** beats **▲ Grove**, **▲ Grove** beats **● Tide**, **● Tide** beats **◆ Ember** — a winning strike deals +1 damage. **✦ Storm** fears nothing and bows to nothing.
- Win by breaking Vex's life to zero before yours falls.

Keys: **1–7** select a hand card · **Enter** end turn · **Esc** back to title.

## Play it

```sh
node serve.ts        # or any static server over game/
```

Then open http://localhost:8080 in desktop Chrome.

## Layout

- `game/index.html` — title screen, table, end screen
- `game/style.css` — table, cards and screens (pure CSS, no assets)
- `game/src/cards.js` — the card pool, deck and element wheel
- `game/src/engine.js` — state, turns, spells and combat
- `game/src/ai.js` — Vex, the Cinder Imp
- `game/src/render.js` — DOM rendering
- `game/src/sound.js` — synthesized WebAudio effects (no files)
- `game/src/main.js` — boot, input and turn flow
- `main.ts` — entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — real renders of this game's own code (title, play, victory, defeat)
