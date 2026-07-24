/* BiZouk — avatars générés en SVG (aucune image à héberger) */
(function () {
  /* 12 palettes de couleurs */
  const PALETTES = [
    { fond:"#7c3aed", accent:"#c4b5fd", nom:"Améthyste" },
    { fond:"#059669", accent:"#6ee7b7", nom:"Émeraude" },
    { fond:"#d97706", accent:"#fde68a", nom:"Ambre" },
    { fond:"#db2777", accent:"#f9a8d4", nom:"Rubis" },
    { fond:"#0284c7", accent:"#7dd3fc", nom:"Saphir" },
    { fond:"#c2410c", accent:"#fdba74", nom:"Braise" },
    { fond:"#0d9488", accent:"#5eead4", nom:"Turquoise" },
    { fond:"#7e22ce", accent:"#e9d5ff", nom:"Orchidée" },
    { fond:"#b91c1c", accent:"#fca5a5", nom:"Grenat" },
    { fond:"#4d7c0f", accent:"#bef264", nom:"Olivine" },
    { fond:"#1d4ed8", accent:"#93c5fd", nom:"Lapis" },
    { fond:"#a16207", accent:"#fcd34d", nom:"Topaze" }
  ];

  /* 8 motifs de fond */
  const MOTIFS = ["plein","cercles","rayures","damier","vagues","etoiles","triangles","points"];

  function motifSVG(type, accent, id) {
    switch (type) {
      case "cercles":
        return '<circle cx="20" cy="22" r="14" fill="' + accent + '" opacity="0.22"/>'
             + '<circle cx="76" cy="72" r="20" fill="' + accent + '" opacity="0.18"/>';
      case "rayures":
        return '<path d="M-10 70 L70 -10 M10 90 L90 10 M30 110 L110 30" stroke="' + accent
             + '" stroke-width="10" opacity="0.18"/>';
      case "damier":
        return '<rect x="0" y="0" width="48" height="48" fill="' + accent + '" opacity="0.15"/>'
             + '<rect x="48" y="48" width="48" height="48" fill="' + accent + '" opacity="0.15"/>';
      case "vagues":
        return '<path d="M0 66 Q24 50 48 66 T96 66 V96 H0 Z" fill="' + accent + '" opacity="0.2"/>'
             + '<path d="M0 78 Q24 62 48 78 T96 78 V96 H0 Z" fill="' + accent + '" opacity="0.14"/>';
      case "etoiles":
        return '<path d="M24 16 l4 9 10 1 -7 7 2 10 -9-5 -9 5 2-10 -7-7 10-1z" fill="' + accent + '" opacity="0.25"/>'
             + '<path d="M70 60 l3 7 8 1 -6 5 2 8 -7-4 -7 4 2-8 -6-5 8-1z" fill="' + accent + '" opacity="0.2"/>';
      case "triangles":
        return '<path d="M0 96 L28 44 L56 96 Z" fill="' + accent + '" opacity="0.18"/>'
             + '<path d="M48 96 L74 52 L96 96 Z" fill="' + accent + '" opacity="0.14"/>';
      case "points":
        return '<circle cx="20" cy="20" r="5" fill="' + accent + '" opacity="0.25"/>'
             + '<circle cx="56" cy="28" r="4" fill="' + accent + '" opacity="0.2"/>'
             + '<circle cx="30" cy="60" r="4" fill="' + accent + '" opacity="0.2"/>'
             + '<circle cx="70" cy="66" r="6" fill="' + accent + '" opacity="0.22"/>';
      default:
        return "";
    }
  }

  let n = 0;

  /* Génère l'avatar : palette + motif + initiales */
  function avatar(config, taille) {
    const c = config || {};
    const p = PALETTES[(c.palette || 0) % PALETTES.length];
    const m = MOTIFS[(c.motif || 0) % MOTIFS.length];
    const px = taille || 64;
    const id = "av" + (++n);
    const initiales = (c.initiales || "?").slice(0, 2).toUpperCase();
    const tailleTexte = initiales.length > 1 ? 38 : 46;

    return '<svg class="avatar" viewBox="0 0 96 96" width="' + px + '" height="' + px + '" '
      + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
      + '<defs>'
      + '<clipPath id="' + id + 'c"><circle cx="48" cy="48" r="48"/></clipPath>'
      + '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0.7" y2="1">'
      +   '<stop offset="0%" stop-color="' + p.accent + '" stop-opacity="0.55"/>'
      +   '<stop offset="55%" stop-color="' + p.fond + '"/>'
      +   '<stop offset="100%" stop-color="' + p.fond + '"/>'
      + '</linearGradient>'
      + '</defs>'
      + '<g clip-path="url(#' + id + 'c)">'
      +   '<rect width="96" height="96" fill="url(#' + id + 'g)"/>'
      +   motifSVG(m, p.accent, id)
      + '</g>'
      + '<text x="48" y="48" text-anchor="middle" dominant-baseline="central" '
      +   'font-family="Georgia, serif" font-weight="700" font-size="' + tailleTexte + '" '
      +   'fill="#ffffff" opacity="0.96">' + initiales + '</text>'
      + '</svg>';
  }

  /* Extrait les initiales d'un nom */
  function initialesDe(nom) {
    const mots = (nom || "").trim().split(/\s+/).filter(Boolean);
    if (!mots.length) return "?";
    if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
    return (mots[0][0] + mots[1][0]).toUpperCase();
  }

  /* Config par défaut déduite du nom (stable) */
  function configDepuisNom(nom) {
    let h = 0;
    const s = nom || "";
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return {
      palette: h % PALETTES.length,
      motif: (h >> 5) % MOTIFS.length,
      initiales: initialesDe(nom)
    };
  }

  /* Encode/décode la config pour la stocker en texte */
  function encoder(c) { return (c.palette||0) + "-" + (c.motif||0); }
  function decoder(txt, nom) {
    if (!txt) return configDepuisNom(nom);
    const parts = String(txt).split("-");
    return {
      palette: parseInt(parts[0], 10) || 0,
      motif: parseInt(parts[1], 10) || 0,
      initiales: initialesDe(nom)
    };
  }

  window.BiZoukAvatar = {
    avatar, initialesDe, configDepuisNom, encoder, decoder,
    PALETTES, MOTIFS,
    nbPalettes: PALETTES.length,
    nbMotifs: MOTIFS.length
  };
})();
