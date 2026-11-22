// Ember Sigil Duel — DOM rendering: cards, boards, life, mana and the log.
// The renderer draws the whole state from scratch each time; CSS animations
// give the deal, the summon and the hit their weight.

import { ELEMENTS, isCreature } from './cards.js';

const $ = (id) => document.getElementById(id);

/** Build one card element (hand card or board creature). */
export function cardElement(card, opts = {}) {
  const el = document.createElement('div');
  el.className = `card ${card.element}`;
  if (opts.selected) el.classList.add('selected');
  if (opts.unaffordable) el.classList.add('unaffordable');
  if (opts.justHit) el.classList.add('just-hit');
  const element = ELEMENTS[card.element];
  const stats = isCreature(card)
    ? `<div class="card-stats"><span class="atk">ATK ${card.atk}</span><span class="hp">HP ${card.hp}</span></div>`
    : `<div class="spell-tag">✦ SPELL ✦</div>`;
  el.innerHTML = `
    <div class="cost">${card.cost}</div>
    <div class="card-name">${card.name}</div>
    <div class="card-glyph">${element.glyph}</div>
    <div class="card-el">${element.name}</div>
    <div class="card-text">${card.text}</div>
    ${stats}`;
  if (opts.onClick) el.addEventListener('click', (ev) => { ev.stopPropagation(); opts.onClick(); });
  return el;
}

function cardBackElement() {
  const el = document.createElement('div');
  el.className = 'card-back';
  el.textContent = '◆';
  return el;
}

/** Draw the whole table from the engine state. */
export function renderTable(state, ui) {
  // Life totals
  $('player-life').textContent = `♥ ${Math.max(0, state.player.life)}`;
  $('enemy-life').textContent = `♥ ${Math.max(0, state.enemy.life)}`;
  $('player-life').classList.toggle('low', state.player.life <= 8);
  $('enemy-life').classList.toggle('low', state.enemy.life <= 8);

  $('round-label').textContent = `ROUND ${state.turn}`;
  $('phase-label').textContent =
    state.phase === 'over' ? 'The duel is over'
    : state.active === 'player' ? 'Your turn — play cards, then end turn'
    : 'Vex is thinking…';

  // Mana pips
  const mana = $('mana-bar');
  mana.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const pip = document.createElement('span');
    pip.className = 'mana-pip' + (i < state.mana ? ' full' : '');
    mana.appendChild(pip);
  }
  const label = document.createElement('span');
  label.id = 'mana-label';
  label.textContent = `${state.mana}/${state.manaMax} mana`;
  mana.appendChild(label);

  $('player-deck').textContent = `Your deck: ${state.player.deck.length}`;
  $('enemy-deck').textContent = `Vex deck: ${state.enemy.deck.length}`;

  // Opponent hand: face-down backs
  const enemyHand = $('enemy-hand');
  enemyHand.innerHTML = '';
  state.enemy.hand.forEach(() => enemyHand.appendChild(cardBackElement()));

  renderBoard($('enemy-board'), state.enemy.board, ui, 'enemy');
  renderBoard($('player-board'), state.player.board, ui, 'player');

  // Player hand
  const hand = $('player-hand');
  hand.innerHTML = '';
  state.player.hand.forEach((card, i) => {
    hand.appendChild(cardElement(card, {
      selected: ui.selectedHand === i,
      unaffordable: card.cost > state.mana || state.active !== 'player',
      onClick: () => ui.onHandCard(i),
    }));
  });

  // End-turn button
  const endBtn = $('btn-end-turn');
  endBtn.disabled = state.active !== 'player' || state.phase !== 'play' || !!ui.targeting;
  endBtn.textContent = state.active === 'player' ? 'END TURN ⏎' : 'VEX PLAYS…';

  // Targeting hint
  const hint = $('target-hint');
  if (ui.targeting) {
    hint.classList.remove('hidden');
    $('target-spell-name').textContent = ui.targeting.name;
  } else {
    hint.classList.add('hidden');
  }

  // Log (newest last, auto-scrolled)
  const log = $('log');
  log.innerHTML = '';
  for (const line of state.log) {
    const li = document.createElement('li');
    li.innerHTML = line;
    log.appendChild(li);
  }
  log.scrollTop = log.scrollHeight;

  // Clear one-shot hit flags after they have been painted
  for (const side of [state.player, state.enemy]) {
    for (const c of side.board) if (c) c.justHit = false;
  }
}

function renderBoard(boardEl, board, ui, who) {
  boardEl.innerHTML = '';
  board.forEach((creature, slot) => {
    if (!creature) {
      const empty = document.createElement('div');
      empty.className = 'board-slot';
      empty.textContent = '—';
      if (ui.targeting && ui.targeting.target === 'any') {
        empty.classList.add('targetable');
        empty.addEventListener('click', () => ui.onTarget({ kind: 'creature', who, slot }));
      }
      boardEl.appendChild(empty);
      return;
    }
    const el = cardElement(creature, { justHit: creature.justHit });
    if (ui.targeting && ui.targeting.target === 'any') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (ev) => { ev.stopPropagation(); ui.onTarget({ kind: 'creature', who, slot }); });
    }
    boardEl.appendChild(el);
  });
}

/** Wire the hero boxes as spell targets while a damage spell is armed. */
export function wireHeroTargets(ui) {
  for (const [id, who] of [['player-hero', 'player'], ['enemy-hero', 'enemy']]) {
    const box = $(id);
    box.classList.remove('targetable');
    box.onclick = null;
    if (ui.targeting && ui.targeting.target === 'any') {
      box.classList.add('targetable');
      box.onclick = () => ui.onTarget({ kind: 'hero', who });
    }
  }
}

/** Show the end screen with the duel's result and stats. */
export function renderEnd(state) {
  const screen = $('end-screen');
  const won = state.winner === 'player';
  screen.classList.toggle('lost', !won);
  $('end-kicker').textContent = won ? 'THE SIGILS BOW TO YOU' : 'THE EMBERS CLAIM YOU';
  $('end-title').textContent = won ? 'VICTORY' : 'DEFEAT';
  $('end-detail').textContent = state.overReason;
  $('end-stats').innerHTML =
    `Rounds played: <b>${state.turn}</b><br>` +
    `Your life: <b>${Math.max(0, state.player.life)}</b> &nbsp;·&nbsp; Vex's life: <b>${Math.max(0, state.enemy.life)}</b><br>` +
    `Creatures you summoned: <b>${state.log.filter((l) => l.includes('Asha summons')).length}</b>`;
}
