// Ember Sigil Duel — Vex, the Cinder Imp: a readable, beatable opponent.
// Vex plays the best affordable card it can, spends damage spells on real
// threats (or for lethal), and heals when its life is low. No randomness
// beyond a seeded tie-break, so a duel replays the same way from one seed.

import { isCreature } from './cards.js';
import { playCard } from './engine.js';

/** Decide Vex's whole turn. Returns the list of actions taken. */
export function takeAiTurn(state) {
  const actions = [];
  const me = state.enemy;
  const foe = state.player;

  // Keep playing while something affordable and useful remains.
  for (let guard = 0; guard < 12; guard++) {
    const pick = chooseCard(state);
    if (!pick) break;
    const { handIndex, target } = pick;
    const card = me.hand[handIndex];
    const result = playCard(state, 'enemy', handIndex, target);
    if (result) actions.push({ name: card.name, result });
    else break;
  }
  return actions;
}

/** Pick the single best card to play now, or null when Vex should stop. */
function chooseCard(state) {
  const me = state.enemy;
  const foe = state.player;
  let best = null;

  me.hand.forEach((card, handIndex) => {
    if (card.cost > state.mana) return;
    if (isCreature(card) && me.board.every((s) => s !== null)) return;
    const score = scoreCard(state, card, handIndex);
    if (score !== null && (!best || score.value > best.value)) {
      best = { value: score.value, handIndex, target: score.target };
    }
  });
  return best;
}

function scoreCard(state, card, handIndex) {
  const me = state.enemy;
  const foe = state.player;

  if (isCreature(card)) {
    // Value: stats per mana, plus a bonus for filling the board early.
    const stats = card.atk + card.hp;
    const boardCount = me.board.filter(Boolean).length;
    const value = (stats / card.cost) * 10 + (boardCount < 2 ? 3 : 0) + (card.cost <= state.mana - 1 ? 1 : 0);
    return { value, target: null };
  }

  if (card.effect === 'damage') {
    // Lethal first: finish the hero when possible.
    if (foe.life <= card.amount) return { value: 100, target: { kind: 'hero', who: 'player' } };
    // Otherwise kill the biggest enemy creature it can.
    let target = null;
    let bestHp = 0;
    foe.board.forEach((c, slot) => {
      if (c && c.hp <= card.amount && c.hp > bestHp) { bestHp = c.hp; target = { kind: 'creature', who: 'player', slot }; }
    });
    if (target) return { value: 40 + bestHp, target };
    // Or chip the hero when the board is empty and nothing better exists.
    if (foe.board.every((s) => s === null)) return { value: 12, target: { kind: 'hero', who: 'player' } };
    return null;
  }
  if (card.effect === 'heal') {
    if (me.life <= 18) return { value: 55, target: null };
    return null; // save it for when it matters
  }
  if (card.effect === 'draw') {
    if (me.hand.length <= 2) return { value: 30, target: null };
    return null;
  }
  if (card.effect === 'mana') {
    // Bloom only helps if a bigger card is waiting in hand.
    const bigger = me.hand.some((c, i) => i !== handIndex && c.cost > state.mana && c.cost <= state.mana + card.amount);
    return bigger ? { value: 25, target: null } : null;
  }
  return null;
}
