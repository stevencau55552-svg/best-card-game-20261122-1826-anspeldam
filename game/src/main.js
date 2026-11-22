// Ember Sigil Duel — boot, input, turn flow and screenshot states.
// Keyboard: 1-7 select a hand card, Enter ends the turn, Esc returns to title.
// Shot modes (?shot=title|play|win|loss) build deterministic states from a
// fixed seed so the maker's screenshots are real renders of this code.

import { newGame, playCard, endTurn, resolveCombat, checkEnd, addLog } from './engine.js';
import { takeAiTurn } from './ai.js';
import { renderTable, renderEnd, wireHeroTargets } from './render.js';
import { isCreature } from './cards.js';
import { sfx } from './sound.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 16);

let state = null;
const ui = {
  selectedHand: null,
  targeting: null, // the armed spell card awaiting a target
  onHandCard,
  onTarget,
};

function show(id) {
  for (const s of ['title-screen', 'table-screen', 'end-screen']) $(s).classList.add('hidden');
  $(id).classList.remove('hidden');
}

function refresh() {
  renderTable(state, ui);
  wireHeroTargets(ui);
  if (state.phase === 'over') {
    renderEnd(state);
    setTimeout(() => show('end-screen'), 650);
  }
}

function startDuel(seed = SEED) {
  state = newGame(seed);
  ui.selectedHand = null;
  ui.targeting = null;
  show('table-screen');
  refresh();
}

/** Click (or key 1-7) on a hand card. */
function onHandCard(index) {
  if (!state || state.phase !== 'play' || state.active !== 'player') return;
  const card = state.player.hand[index];
  if (!card) return;
  if (ui.targeting) { ui.targeting = null; ui.selectedHand = null; refresh(); return; }
  if (card.cost > state.mana) { sfx('deny'); return; }
  if (isCreature(card)) {
    const result = playCard(state, 'player', index);
    if (result) { sfx('summon'); ui.selectedHand = null; refresh(); }
    return;
  }
  if (card.effect === 'damage') {
    ui.targeting = card;
    ui.selectedHand = index;
    sfx('select');
    refresh();
    return;
  }
  const result = playCard(state, 'player', index);
  if (result) { sfx('spell'); ui.selectedHand = null; refresh(); }
}

/** Click on a target while a damage spell is armed. */
function onTarget(target) {
  if (!ui.targeting || ui.selectedHand === null) return;
  const index = ui.selectedHand;
  const card = state.player.hand[index];
  ui.targeting = null;
  ui.selectedHand = null;
  const result = playCard(state, 'player', index, target);
  if (result) { sfx('spell'); refresh(); }
}

async function endPlayerTurn() {
  if (!state || state.phase !== 'play' || state.active !== 'player') return;
  ui.targeting = null;
  ui.selectedHand = null;
  addLog(state, 'Asha ends the turn.');
  endTurn(state); // -> Vex's turn
  refresh();
  await wait(450);
  takeAiTurn(state);
  refresh();
  await wait(450);
  if (state.phase === 'over') { sfx(state.winner === 'player' ? 'win' : 'lose'); refresh(); return; }
  resolveCombat(state);
  if (state.phase === 'over') { sfx(state.winner === 'player' ? 'win' : 'lose'); refresh(); return; }
  endTurn(state); // -> Asha's turn, draws, mana grows
  sfx('turn');
  refresh();
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------- buttons & keys ----------
$('btn-start').addEventListener('click', () => { sfx('start'); startDuel(); });
$('btn-again').addEventListener('click', () => { sfx('start'); startDuel(); });
$('btn-title').addEventListener('click', () => { show('title-screen'); });
$('btn-end-turn').addEventListener('click', () => { endPlayerTurn(); });
$('btn-cancel-target').addEventListener('click', () => {
  ui.targeting = null; ui.selectedHand = null; refresh();
});
document.addEventListener('keydown', (ev) => {
  if (!state || $('table-screen').classList.contains('hidden')) {
    if (ev.key === 'Enter' && !$('title-screen').classList.contains('hidden')) { sfx('start'); startDuel(); }
    return;
  }
  if (ev.key >= '1' && ev.key <= '7') onHandCard(Number(ev.key) - 1);
  else if (ev.key === 'Enter') endPlayerTurn();
  else if (ev.key === 'Escape') { ui.targeting = null; ui.selectedHand = null; show('title-screen'); }
});

/** Greedy auto-player used only to build the deterministic play screenshot. */
function autoPlaySide(g, who) {
  for (let guard = 0; guard < 8; guard++) {
    const i = g[who].hand.findIndex((c) => isCreature(c) && c.cost <= g.mana);
    if (i === -1) break;
    if (!playCard(g, who, i)) break;
  }
}

// ---------- deterministic screenshot states ----------
function buildShotState(mode) {
  const g = newGame(SEED);
  if (mode === 'play') {
    // Play three full rounds, exactly like a real duel: Vex plays, combat,
    // Asha plays (greedy), then the next round.
    for (let round = 0; round < 3 && g.phase === 'play'; round++) {
      g.active = 'enemy'; g.mana = g.manaMax;
      takeAiTurn(g);
      resolveCombat(g);
      if (g.phase === 'over') break;
      endTurn(g); // -> Asha's turn: draw, mana grows
      autoPlaySide(g, 'player');
      endTurn(g); // -> Vex's turn
    }
    // Ensure a lively board even if the scripted rounds stayed quiet.
    if (g.player.board.every((s) => s === null)) {
      const c = g.player.hand.find((card) => isCreature(card));
      if (c) g.player.board[1] = { ...c, hp: 5, maxHp: 5 };
    }
    if (g.enemy.board.every((s) => s === null)) {
      const c = g.enemy.hand.find((card) => isCreature(card));
      if (c) g.enemy.board[2] = { ...c, hp: 4, maxHp: 4 };
    }
    g.active = 'player';
    g.mana = g.manaMax;
    addLog(g, 'The table is set — your move, Asha.');
  } else if (mode === 'win') {
    g.turn = 8;
    g.enemy.life = 2;
    g.player.board[2] = { id: 'ash-phoenix', name: 'Ash Phoenix', element: 'ember', cost: 6, atk: 7, hp: 6, maxHp: 6, text: 'Rises again, brighter.', uid: 'shot-win' };
    g.player.life = 18;
    g.enemy.board[1] = { id: 'coral-guard', name: 'Coral Guard', element: 'tide', cost: 3, atk: 3, hp: 5, maxHp: 5, text: 'A wall that swims.', uid: 'shot-win-2' };
    addLog(g, 'Asha summons <b>Ash Phoenix</b> (7/6).');
    addLog(g, 'Vex summons <b>Coral Guard</b> (3/5).');
    resolveCombat(g);
    checkEnd(g);
  } else if (mode === 'loss') {
    g.turn = 9;
    g.player.life = 2;
    g.enemy.board[2] = { id: 'thunder-drake', name: 'Thunder Drake', element: 'storm', cost: 5, atk: 6, hp: 5, maxHp: 5, text: 'It nests in lightning.', uid: 'shot-loss' };
    g.enemy.life = 24;
    g.player.board[1] = { id: 'bark-sentinel', name: 'Bark Sentinel', element: 'grove', cost: 3, atk: 2, hp: 6, maxHp: 6, text: 'Older than the forest.', uid: 'shot-loss-2' };
    addLog(g, 'Vex summons <b>Thunder Drake</b> (6/5).');
    addLog(g, 'Asha summons <b>Bark Sentinel</b> (2/6).');
    resolveCombat(g);
    checkEnd(g);
  }
  return g;
}

// ---------- boot ----------
// Screenshot states render with animations off so the capture is settled.
if (SHOT) document.documentElement.classList.add('shot-mode');
if (SHOT === 'title' || !SHOT) {
  show('title-screen');
} else {
  state = buildShotState(SHOT);
  show('table-screen');
  refresh();
  if (state.phase === 'over') {
    renderEnd(state);
    show('end-screen');
  }
}
