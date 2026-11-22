// Ember Sigil Duel — card pool and deck building.
// Four elements, each told apart by colour AND shape: Ember ◆, Tide ●, Grove ▲, Storm ✦.
// Element wheel: Ember beats Grove, Grove beats Tide, Tide beats Ember (a winning
// strike deals +1 damage). Storm has no advantage and no weakness.

export const ELEMENTS = {
  ember: { name: 'Ember', glyph: '◆', beats: 'grove' },
  tide:  { name: 'Tide',  glyph: '●', beats: 'ember' },
  grove: { name: 'Grove', glyph: '▲', beats: 'tide' },
  storm: { name: 'Storm', glyph: '✦', beats: null },
};

/** Creature cards: id, name, element, cost, attack, health, flavour. */
export const CREATURES = [
  { id: 'ember-pup',     name: 'Ember Pup',     element: 'ember', cost: 1, atk: 2, hp: 1, text: 'A biting spark.' },
  { id: 'cinder-wisp',   name: 'Cinder Wisp',   element: 'ember', cost: 2, atk: 3, hp: 2, text: 'Giggles, burning.' },
  { id: 'flame-imp',     name: 'Flame Imp',     element: 'ember', cost: 3, atk: 4, hp: 3, text: 'Big temper.' },
  { id: 'magma-hound',   name: 'Magma Hound',   element: 'ember', cost: 4, atk: 5, hp: 4, text: 'Bark of wildfire.' },
  { id: 'ash-phoenix',   name: 'Ash Phoenix',   element: 'ember', cost: 6, atk: 7, hp: 6, text: 'Rises, brighter.' },
  { id: 'tide-minnow',   name: 'Tide Minnow',   element: 'tide',  cost: 1, atk: 1, hp: 3, text: 'Slippery guard.' },
  { id: 'bubble-eel',    name: 'Bubble Eel',    element: 'tide',  cost: 2, atk: 2, hp: 3, text: 'Shocks grabbers.' },
  { id: 'coral-guard',   name: 'Coral Guard',   element: 'tide',  cost: 3, atk: 3, hp: 5, text: 'A swimming wall.' },
  { id: 'deep-leviathan',name: 'Deep Leviathan',element: 'tide',  cost: 6, atk: 6, hp: 7, text: 'Tide with teeth.' },
  { id: 'sproutling',    name: 'Sproutling',    element: 'grove', cost: 1, atk: 1, hp: 2, text: 'Growing trouble.' },
  { id: 'thorn-wolf',    name: 'Thorn Wolf',    element: 'grove', cost: 2, atk: 3, hp: 2, text: 'Thorns, not fur.' },
  { id: 'bark-sentinel', name: 'Bark Sentinel', element: 'grove', cost: 3, atk: 2, hp: 6, text: 'Older than trees.' },
  { id: 'vine-titan',    name: 'Vine Titan',    element: 'grove', cost: 5, atk: 5, hp: 7, text: 'Forest, standing.' },
  { id: 'storm-sprite',  name: 'Storm Sprite',  element: 'storm', cost: 2, atk: 2, hp: 2, text: 'Thunder laughs.' },
  { id: 'gale-falcon',   name: 'Gale Falcon',   element: 'storm', cost: 3, atk: 4, hp: 2, text: 'Outruns the rain.' },
  { id: 'thunder-drake', name: 'Thunder Drake', element: 'storm', cost: 5, atk: 6, hp: 5, text: 'Lightning nest.' },
];

/** Spell cards: id, name, element, cost, effect, amount, flavour. */
export const SPELLS = [
  { id: 'ember-burst', name: 'Ember Burst', element: 'ember', cost: 2, effect: 'damage', amount: 4, target: 'any', text: 'Deal 4 damage.' },
  { id: 'tide-mend',   name: 'Tide Mend',   element: 'tide',  cost: 2, effect: 'heal',   amount: 7, target: 'own-hero', text: 'Restore 7 life.' },
  { id: 'storm-call',  name: 'Storm Call',  element: 'storm', cost: 3, effect: 'draw',   amount: 2, target: 'none', text: 'Draw 2 cards.' },
  { id: 'grove-bloom', name: 'Grove Bloom', element: 'grove', cost: 1, effect: 'mana',   amount: 2, target: 'none', text: 'Gain 2 mana.' },
];

export const CARD_BY_ID = {};
for (const c of [...CREATURES, ...SPELLS]) CARD_BY_ID[c.id] = c;

export function isCreature(card) { return card.atk !== undefined; }

/** A 26-card deck: a curve of cheap creatures, a few finishers, and spells. */
export const DECK_LIST = [
  'ember-pup', 'ember-pup', 'tide-minnow', 'tide-minnow', 'sproutling', 'sproutling',
  'cinder-wisp', 'cinder-wisp', 'bubble-eel', 'thorn-wolf', 'thorn-wolf', 'storm-sprite',
  'flame-imp', 'flame-imp', 'coral-guard', 'bark-sentinel', 'gale-falcon',
  'magma-hound', 'vine-titan', 'thunder-drake', 'ash-phoenix', 'deep-leviathan',
  'ember-burst', 'tide-mend', 'storm-call', 'grove-bloom',
].map((id) => CARD_BY_ID[id]);

/** Small seeded PRNG (mulberry32) so screenshot states are reproducible. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh shuffled deck of card instances (each with a unique uid). */
export function buildDeck(seed) {
  const rng = makeRng(seed);
  const cards = DECK_LIST.map((def, i) => ({ ...def, uid: `c${i}-${seed}` }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Damage bonus: +1 when the attacker's element beats the defender's. */
export function elementBonus(attackerElement, defenderElement) {
  return ELEMENTS[attackerElement].beats === defenderElement ? 1 : 0;
}
