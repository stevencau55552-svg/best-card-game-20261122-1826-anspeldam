// Ember Sigil Duel — tiny synthesized sound effects (WebAudio, no files).
// Everything is generated in code, so the game loads nothing over the network.

let ctx = null;

function audio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.08, when = 0) {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + when + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(ac.currentTime + when);
    osc.stop(ac.currentTime + when + dur);
  } catch { /* sound is decoration; a silent game still plays */ }
}

export function sfx(kind) {
  switch (kind) {
    case 'start': tone(523, 0.12, 'triangle'); tone(784, 0.18, 'triangle', 0.08, 0.1); break;
    case 'summon': tone(392, 0.1, 'square', 0.05); tone(523, 0.14, 'square', 0.05, 0.08); break;
    case 'spell': tone(880, 0.16, 'sine', 0.07); tone(660, 0.2, 'sine', 0.06, 0.1); break;
    case 'select': tone(660, 0.07, 'sine', 0.06); break;
    case 'deny': tone(160, 0.15, 'sawtooth', 0.05); break;
    case 'turn': tone(440, 0.09, 'triangle', 0.06); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, i * 0.12)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, i * 0.14)); break;
    default: break;
  }
}
