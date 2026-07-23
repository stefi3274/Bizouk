/* BiZouk — parcours : 3 parties, 3 niveaux chacune, bombes entre les parties */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(6000) : null); }

  const NIVEAUX = [
    { mots: 15, nom: "Découverte", classe: "niv-decouverte", couleur: "vert" },
    { mots: 20, nom: "Confirmé",   classe: "niv-confirme",   couleur: "jaune" },
    { mots: 25, nom: "Expert",     classe: "niv-expertn",    couleur: "rose" }
  ];
  const PARTIES = [
    { num: 1, titre: "Première partie", sous: "Les fondations" },
    { num: 2, titre: "Deuxième partie", sous: "On monte d'un cran" },
    { num: 3, titre: "Troisième partie", sous: "Le dernier souffle" }
  ];

  function majCompteur() {
    const d = window.Progression.detail();
    $("bzVert").textContent = d.vert;
    $("bzJaune").textContent = d.jaune;
    $("bzRose").textContent = d.rose;
  }

  function dessiner() {
    const P = window.Progression;
    const zone = $("parcoursZone");
    let html = "";

    PARTIES.forEach((partie, iP) => {
      // La partie est ouverte si son premier niveau l'est
      const ouverte = P.ouvert(partie.num, 15);
      const finie = P.reussi(partie.num, 25);

      html += '<section class="partie' + (ouverte ? '' : ' verrou') + '">'
        + '<div class="partie-head">'
        + '<span class="partie-num">' + partie.num + '</span>'
        + '<div><h2>' + partie.titre + (finie ? ' ✓' : '') + '</h2>'
        + '<div class="ph-sous">' + (ouverte ? partie.sous : 'Termine la partie précédente pour ouvrir') + '</div></div>'
        + '</div>'
        + '<div class="niv-liste">';

      NIVEAUX.forEach(niv => {
        const fait = P.reussi(partie.num, niv.mots);
        const ouvert = P.ouvert(partie.num, niv.mots);
        const cls = niv.classe + (fait ? ' fait' : '') + (ouvert ? '' : ' verrou');
        const lien = ouvert ? 'jeu.html?partie=' + partie.num + '&niveau=' + niv.mots : '#';
        html += '<a class="niv-case ' + cls + '" href="' + lien + '">'
          + '<div class="nc-head"><span class="nc-nom">' + niv.nom + '</span>'
          + '<span class="nc-etat">' + (fait ? '✓' : (ouvert ? '' : '🔒')) + '</span></div>'
          + '<div class="nc-mots">' + niv.mots + ' mots à trouver</div>'
          + '<div class="nc-gain">' + (fait ? 'Réussi · 3 pierres gagnées' : '+3 pierres ' + niv.couleur) + '</div>'
          + '</a>';
      });

      html += '</div></section>';

      // Bombe entre les parties (pas après la dernière)
      if (iP < PARTIES.length - 1) {
        const partieFinie = P.reussi(partie.num, 25);
        const bloque = P.bloque();
        html += '<div class="bombe-sep' + (partieFinie ? '' : ' verrou') + '">'
          + '<span class="bombe-icone">💣</span>'
          + '<div class="bombe-txt"><h3>La Bombe</h3>'
          + '<p>' + (partieFinie
              ? (bloque ? 'Bombe explosée. Attends ou dépense 5 pierres.' : '2 minutes pour désamorcer. 2 mots à trouver.')
              : 'Termine la partie ' + partie.num + ' pour l\'affronter.') + '</p></div>'
          + (partieFinie
              ? '<a class="btn btn-v btn-sm" href="bombe.html?apres=' + partie.num + '">'
                + (bloque ? 'Voir' : 'Affronter') + '</a>'
              : '<button class="btn btn-g btn-sm" disabled>Verrouillé</button>')
          + '</div>';
      }
    });

    zone.innerHTML = html;
  }

  async function init() {
    // 1) Affichage immédiat avec les données locales (pas d'attente)
    majCompteur();
    dessiner();

    // 2) Synchronisation avec le compte en arrière-plan
    await window.Progression.init();
    majCompteur();
    dessiner();

    if (!window.Progression.connecte()) {
      $("inviteCompte").style.display = "block";
    } else {
      $("inviteCompte").style.display = "none";
      const nav = $("navAuth");
      if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
    }
  }

  init();
})();
