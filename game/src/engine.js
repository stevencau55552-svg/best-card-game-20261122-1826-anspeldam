// Ember Sigil Duel — game engine: state, turns, spells and combat.
// Pure logic, no DOM: render.js draws whatever this state holds.

import { buildDeck, elementBonus, isCreature } from './cards.js';

export const BOARD_SLOTS = 5;
export const START_LIFE = 30;
export const MAX_MANA = 10;
export const START_HAND = 3;

/** A fresh duel. `seed` drives both decks so a duel can be replayed. */
export function newGame(seed = (Date.now() % 100000)) {
  const state = {
    seed,
    phase: 'play',          // 'play' | 'over'
    turn: 1,
    active: 'player',       // whose turn it is
    manaMax: 1,
    mana: 1,
    winner: null,           // 'player' | 'enemy'
    overReason: '',
    log: [],
    player: newSide(buildDeck(seed)),
    enemy: newSide(buildDeck(seed + 101)),
  };
  drawCards(state.player, START_HAND);
  drawCards(state.enemy, START_HAND);
  addLog(state, 'The duel begins. Asha draws 3 cards; Vex draws 3.');
  return state;
}

function newSide(deck) {
  return { life: START_LIFE, deck, hand: [], board: Array(BOARD_SLOTS).fill(null) };
}

export function addLog(state, text) {
  state.log.push(text);
  if (state.log.length > 60) state.log.shift();
}

/** Draw n cards (fatigue: empty deck costs 1 life per missing card). */
export function drawCards(side, n) {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    const card = side.deck.pop();
    if (!card) { side.life -= 1; continue; }
    if (side.hand.length >= 7) continue; // hand full: card burns
    side.hand.push(card);
    drawn++;
  }
  return drawn;
}

function freeSlot(side) {
  return side.board.findIndex((slot) => slot === null);
}

/** Can this side play this card right now? Returns '' or a reason. */
export function playBlockReason(state, who, card) {
  const side = state[who];
  if (state.phase !== 'play' || state.active !== who) return 'not your turn';
  if (card.cost > state.mana && who === 'player') return 'not enough mana';
  if (card.cost > state.mana) return 'not enough mana';
  if (isCreature(card) && freeSlot(side) === -1) return 'board is full';
  return '';
}

/**
 * Play a card. Creatures go to the first free board slot.
 * Spells resolve at once; 'any'-target spells need a target descriptor:
 *   { kind: 'hero', who: 'enemy' } or { kind: 'creature', who: 'enemy'|'player', slot }
 * Returns the log line, or null when blocked.
 */
export function playCard(state, who, handIndex, target = null) {
  const side = state[who];
  const card = side.hand[handIndex];
  if (!card) return null;
  const blocked = playBlockReason(state, who, card);
  if (blocked) return null;
  if (isCreature(card)) {
    side.hand.splice(handIndex, 1);
    state.mana -= card.cost;
    const slot = freeSlot(side);
    side.board[slot] = { ...card, hp: card.hp, maxHp: card.hp, justPlayed: true };
    addLog(state, `${name(who)} summons <b>${card.name}</b> (${card.atk}/${card.hp}).`);
    return 'creature';
  }
  // ---- spells ----
  if (card.effect === 'damage' && !target) return 'needs-target';
  if (card.effect === 'damage' && target.kind === 'creature' && !state[target.who].board[target.slot]) return null;
  side.hand.splice(handIndex, 1);
  state.mana -= card.cost;
  if (card.effect === 'damage') {
    if (target.kind === 'hero') {
      const foe = state[target.who];
      foe.life -= card.amount;
      addLog(state, `<b>${card.name}</b> blasts ${name(target.who)} for ${card.amount} damage.`);
    } else {
      const foe = state[target.who];
      const victim = foe.board[target.slot];
      if (!victim) return null;
      victim.hp -= card.amount;
      addLog(state, `<b>${card.name}</b> blasts ${victim.name} for ${card.amount} damage.`);
      sweepDead(state, target.who);
    }
  } else if (card.effect === 'heal') {
    side.life = Math.min(START_LIFE, side.life + card.amount);
    addLog(state, `${name(who)} mends ${card.amount} life with <b>${card.name}</b>.`);
  } else if (card.effect === 'draw') {
    const n = drawCards(side, card.amount);
    addLog(state, `${name(who)} draws ${n} cards with <b>${card.name}</b>.`);
  } else if (card.effect === 'mana') {
    state.mana += card.amount;
    addLog(state, `${name(who)} blooms +${card.amount} mana with <b>${card.name}</b>.`);
  }
  checkEnd(state);
  return 'spell';
}

function name(who) { return who === 'player' ? 'Asha' : 'Vex'; }

/** Remove creatures at 0 or less health from a side's board. */
export function sweepDead(state, who) {
  const side = state[who];
  side.board = side.board.map((c) => {
    if (c && c.hp <= 0) {
      addLog(state, `${c.name} crumbles to ash.`);
      return null;
    }
    return c;
  });
}

/**
 * Combat: every creature strikes at once. Each creature hits the creature
 * directly opposite it, or the enemy hero when that slot is empty.
 * Element advantage adds +1 damage.
 */
export function resolveCombat(state) {
  const strikes = [];
  for (let slot = 0; slot < BOARD_SLOTS; slot++) {
    const p = state.player.board[slot];
    const e = state.enemy.board[slot];
    if (p) strikes.push({ from: 'player', card: p, slot, target: e ? { kind: 'creature', who: 'enemy', slot } : { kind: 'hero', who: 'enemy' } });
    if (e) strikes.push({ from: 'enemy', card: e, slot, target: p ? { kind: 'creature', who: 'player', slot } : { kind: 'hero', who: 'player' } });
  }
  if (strikes.length === 0) {
    addLog(state, 'No creatures stand — the round passes in silence.');
    return;
  }
  addLog(state, '— Combat: creatures strike! —');
  for (const s of strikes) {
    const bonus = s.target.kind === 'creature'
      ? elementBonus(s.card.element, state[s.target.who].board[s.target.slot]?.element ?? '')
      : 0;
    const dmg = s.card.atk + bonus;
    if (s.target.kind === 'hero') {
      state[s.target.who].life -= dmg;
      addLog(state, `${s.card.name} hits ${name(s.target.who)} for ${dmg}.`);
    } else {
      const victim = state[s.target.who].board[s.target.slot];
      if (!victim) continue;
      victim.hp -= dmg;
      victim.justHit = true;
      addLog(state, `${s.card.name} strikes ${victim.name} for ${dmg}${bonus ? ' (element advantage +1)' : ''}.`);
    }
  }
  sweepDead(state, 'player');
  sweepDead(state, 'enemy');
  checkEnd(state);
}

/** End the current turn: the other side starts, draws, and gains mana. */
export function endTurn(state) {
  if (state.phase !== 'play') return;
  state.active = state.active === 'player' ? 'enemy' : 'player';
  if (state.active === 'player') {
    state.turn += 1;
    state.manaMax = Math.min(MAX_MANA, state.manaMax + 1);
  }
  state.mana = state.manaMax;
  const side = state[state.active];
  const drawn = drawCards(side, 1);
  if (drawn) addLog(state, `${name(state.active)} draws a card.`);
  if (side.life <= 0) checkEnd(state);
}

/** Life 0 (or below) ends the duel. */
export function checkEnd(state) {
  if (state.phase === 'over') return;
  const pDead = state.player.life <= 0;
  const eDead = state.enemy.life <= 0;
  if (!pDead && !eDead) return;
  state.phase = 'over';
  if (eDead && !pDead) {
    state.winner = 'player';
    state.overReason = 'Vex\u2019s life fell to zero — the last sigil burns out.';
  } else if (pDead && !eDead) {
    state.winner = 'enemy';
    state.overReason = 'Asha\u2019s life fell to zero — Vex cackles over the embers.';
  } else {
    state.winner = 'player'; // simultaneous fall: the challenger takes it
    state.overReason = 'Both heroes fell at once — the duel goes to the challenger.';
  }
  addLog(state, state.overReason);
}
