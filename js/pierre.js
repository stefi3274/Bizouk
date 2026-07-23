/* BiZouk — la pierre précieuse (rendu SVG avec facettes et éclat) */
(function () {
  const TEINTES = {
    vert:  { clair:"#6ee7b7", moyen:"#34d399", fonce:"#059669", sombre:"#065f46" },
    jaune: { clair:"#fde68a", moyen:"#f0b429", fonce:"#d97706", sombre:"#92400e" },
    rose:  { clair:"#f9a8d4", moyen:"#f472b6", fonce:"#db2777", sombre:"#9d174d" },
    violet:{ clair:"#c4b5fd", moyen:"#a78bfa", fonce:"#7c3aed", sombre:"#4c1d95" }
  };

  let compteur = 0;

  /* Dessine une gemme taillée : table centrale, couronne à facettes, pointe */
  function pierre(couleur, taille) {
    const t = TEINTES[couleur] || TEINTES.violet;
    const px = taille || 24;
    const id = "gem" + (++compteur);

    return '<svg class="pierre" viewBox="0 0 40 44" width="' + px + '" height="' + Math.round(px*1.1) + '" '
      + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
      + '<defs>'
      // Dégradé principal du corps
      + '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="0.6" y2="1">'
      +   '<stop offset="0%" stop-color="' + t.clair + '"/>'
      +   '<stop offset="45%" stop-color="' + t.moyen + '"/>'
      +   '<stop offset="100%" stop-color="' + t.sombre + '"/>'
      + '</linearGradient>'
      // Dégradé des facettes claires
      + '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="0.8">'
      +   '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>'
      +   '<stop offset="100%" stop-color="' + t.clair + '" stop-opacity="0.25"/>'
      + '</linearGradient>'
      // Dégradé des facettes sombres
      + '<linearGradient id="' + id + 'c" x1="1" y1="0" x2="0" y2="1">'
      +   '<stop offset="0%" stop-color="' + t.fonce + '"/>'
      +   '<stop offset="100%" stop-color="' + t.sombre + '"/>'
      + '</linearGradient>'
      + '</defs>'

      // Corps de la gemme (taille en pointe)
      + '<path d="M20 2 L36 15 L20 42 L4 15 Z" fill="url(#' + id + 'a)"/>'
      // Facette gauche de la couronne (claire)
      + '<path d="M20 2 L4 15 L13 15 Z" fill="url(#' + id + 'b)" opacity="0.9"/>'
      // Table centrale (la face plate du dessus)
      + '<path d="M20 2 L13 15 L27 15 Z" fill="' + t.clair + '" opacity="0.55"/>'
      // Facette droite de la couronne (sombre)
      + '<path d="M20 2 L36 15 L27 15 Z" fill="url(#' + id + 'c)" opacity="0.8"/>'
      // Ligne de ceinture
      + '<path d="M4 15 L36 15" stroke="' + t.clair + '" stroke-width="0.8" opacity="0.5"/>'
      // Facettes du pavillon (partie basse)
      + '<path d="M13 15 L20 42 L4 15 Z" fill="' + t.sombre + '" opacity="0.35"/>'
      + '<path d="M27 15 L20 42 L36 15 Z" fill="' + t.clair + '" opacity="0.18"/>'
      // Éclat lumineux
      + '<path d="M17 6 L15 13 L18 13 Z" fill="#ffffff" opacity="0.7"/>'
      + '<circle cx="24" cy="9" r="1.3" fill="#ffffff" opacity="0.55"/>'
      + '</svg>';
  }

  /* Pierre + nombre, prêt à insérer */
  function badge(couleur, nombre, taille) {
    return '<span class="bz-badge bz-' + couleur + '">'
      + pierre(couleur, taille || 18)
      + '<span class="bz-nb">' + nombre + '</span></span>';
  }

  window.BiZoukPierre = { pierre, badge, TEINTES };
})();
