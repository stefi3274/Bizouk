/* BiZouk — petite pluie de confettis (canvas vanilla, sans librairie)
   Utilisé pour célébrer un palier de série (3, 7, 14, 30, 60, 100 jours). */
(function () {
  function lancer(duree, intensite) {
    const dureeMs = duree || 2200;
    const mult = intensite || 1;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    function redim() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    redim();
    window.addEventListener("resize", redim);

    const couleurs = ["#7c5cff", "#34d399", "#f0b429", "#fb7185", "#60a5fa", "#fb923c"];
    const N = Math.max(20, Math.round((window.innerWidth < 500 ? 90 : 150) * mult));
    const particules = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.6,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2.2 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 2.4,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      coul: couleurs[Math.floor(Math.random() * couleurs.length)]
    }));

    const debut = Date.now();
    function boucle() {
      const t = Date.now() - debut;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particules.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.coul;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < dureeMs) {
        requestAnimationFrame(boucle);
      } else {
        window.removeEventListener("resize", redim);
        canvas.remove();
      }
    }
    boucle();
  }

  window.BiZoukConfetti = { lancer };
})();
