/* BiZouk — réserve de mots courants pour construire le "mot mystère" garanti
   (quelle que soit la longueur de cases restantes après placement des mots normaux). */
(function () {
  // Mots courants français, en majuscules sans accents, longueur 2 à 9.
  // Volontairement neutres et variés pour pouvoir combler n'importe quelle longueur.
  const BANQUE = [
    "LE","LA","LES","UN","UNE","DE","DU","ET","OU","SI","NE","SE","CE","ON","IL",
    "TU","JE","EN","AU","VU","EU","AN","ETE","EAU","MER","CIEL","FEU","AIR","OS",
    "CHAT","CHIEN","OISEAU","POISSON","LION","OURS","LOUP","RENARD","SOURIS",
    "MAISON","JARDIN","ECOLE","VILLE","PAYS","ROUTE","PONT","PORTE","MUR",
    "TABLE","CHAISE","LIVRE","STYLO","PAPIER","CAHIER","SAC","CLE","LAMPE",
    "SOLEIL","LUNE","ETOILE","NUAGE","PLUIE","VENT","NEIGE","ORAGE","ARBRE",
    "FLEUR","FRUIT","LEGUME","PAIN","LAIT","OEUF","SEL","SUCRE","MIEL","THE",
    "CAFE","EAU","JUS","VIN","RIZ","PATE","SOUPE","GATEAU","GLACE","BONBON",
    "AMI","AMIE","FAMILLE","MERE","PERE","SOEUR","FRERE","ENFANT","BEBE",
    "TEMPS","JOUR","NUIT","MATIN","SOIR","HEURE","MINUTE","SEMAINE","MOIS",
    "ANNEE","HIER","DEMAIN","TOUJOURS","JAMAIS","SOUVENT","PARFOIS",
    "GRAND","PETIT","BEAU","JOLI","FORT","FAIBLE","RAPIDE","LENT","CHAUD",
    "FROID","DOUX","DUR","LEGER","LOURD","LARGE","ETROIT","HAUT","BAS",
    "ROUGE","BLEU","VERT","JAUNE","NOIR","BLANC","GRIS","ROSE","VIOLET",
    "ORANGE","MARRON","DANSE","CHANT","MUSIQUE","JEU","SPORT","COURSE",
    "VOYAGE","PLAGE","MONTAGNE","FORET","RIVIERE","LAC","ILE","DESERT",
    "VILLAGE","QUARTIER","MARCHE","MAGASIN","HOPITAL","BUREAU","USINE",
    "TRAVAIL","METIER","ARGENT","PRIX","CADEAU","FETE","NOEL","ANNIVERSAIRE",
    "HISTOIRE","LANGUE","MOT","PHRASE","LETTRE","NOM","IDEE","REVE","ESPOIR",
    "COURAGE","FORCE","PAIX","GUERRE","LIBERTE","VERITE","BONHEUR","AMOUR"
  ];

  function normaliser(mot) {
    return (mot || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase().replace(/[^A-Z]/g, "");
  }

  const PAR_LONGUEUR = {};
  BANQUE.forEach(m => {
    const n = normaliser(m);
    if (!n) return;
    (PAR_LONGUEUR[n.length] = PAR_LONGUEUR[n.length] || []).push(n);
  });

  function melanger(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Construit une "phrase" (liste de mots) dont le total de lettres vaut
     exactement `longueurCible`. Retourne null seulement dans un cas extrême
     (longueur cible trop petite, ex. 1, où aucun mot n'existe). */
  function construirePhrase(longueurCible, essaisMax) {
    if (longueurCible <= 0) return [];
    const longueursDispo = Object.keys(PAR_LONGUEUR).map(Number).sort((a,b) => b-a);

    for (let essai = 0; essai < (essaisMax || 60); essai++) {
      let reste = longueurCible;
      const phrase = [];
      let bloque = false;

      while (reste > 0) {
        const candidats = longueursDispo.filter(l => l <= reste);
        if (!candidats.length) { bloque = true; break; }
        // On favorise les mots plus longs (moins de mots au total), avec un peu d'aléatoire
        const poids = candidats.filter(l => l >= Math.min(reste, 4) || candidats.length <= 2);
        const choix = melanger(poids.length ? poids : candidats)[0];
        const mot = melanger(PAR_LONGUEUR[choix])[0];
        phrase.push(mot);
        reste -= mot.length;
      }
      if (!bloque && reste === 0) return phrase;
    }
    return null; // extrêmement rare (ex. longueur cible = 1)
  }

  window.BiZoukMystere = { construirePhrase, normaliser };
})();
