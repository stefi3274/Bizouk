/* BiZouk — petits sons de jeu (Web Audio, sans fichier audio externe) */
(function () {
  let ctx = null;

  function contexte() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function note(freq, debut, duree, gain, type) {
    const c = contexte();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    const t0 = c.currentTime + debut;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duree);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duree + 0.02);
  }

  function jouer(nom) {
    try {
      if (nom === "trouve") {
        note(880, 0, 0.09, 0.16, "sine");
        note(1318.5, 0.06, 0.12, 0.14, "sine");
      } else if (nom === "combo") {
        note(988, 0, 0.08, 0.15, "triangle");
        note(1318.5, 0.05, 0.08, 0.15, "triangle");
        note(1568, 0.10, 0.12, 0.15, "triangle");
      } else if (nom === "victoire") {
        note(523.25, 0,    0.14, 0.16, "sine");
        note(659.25, 0.09, 0.14, 0.16, "sine");
        note(783.99, 0.18, 0.22, 0.18, "sine");
        note(1046.5, 0.30, 0.30, 0.18, "sine");
      }
    } catch (e) {}
  }

  window.BiZoukSon = { jouer };
})();
