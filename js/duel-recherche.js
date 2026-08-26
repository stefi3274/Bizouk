/* BiZouk — défier un joueur trouvé par pseudo */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");

  let monId = null, monNom = "", cible = null, chaps = [], debut = null, minuteur = null, fini = false, mesMots = null, chapChoisi = null;

  async function moi() {
    const base = await db();
    if (!base) return;
    const { data } = await base.auth.getSession();
    if (data.session) {
      monId = data.session.user.id;
      monNom = (data.session.user.user_metadata && data.session.user.user_metadata.nom) || "";
      const nav = $("navAuth");
      if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
    }
  }

  function melanger(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  let debounce = null;
  $("rechPseudo").addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => rechercher($("rechPseudo").value), 350);
  });

  async function rechercher(q) {
    const zone = $("rechResultats");
    if (!q || q.trim().length < 2) { zone.innerHTML = ""; return; }
    zone.innerHTML = '<p style="color:var(--texte-faible);font-style:italic;font-size:.85rem">Recherche…</p>';
    const resultats = await window.BiZoukDuel.chercherJoueur(q);
    if (!resultats.length) { zone.innerHTML = '<p style="color:var(--texte-faible);font-style:italic;font-size:.85rem">Aucun joueur trouvé.</p>'; return; }
    zone.innerHTML = resultats.map(r =>
      '<button type="button" class="niv-radio" data-uid="' + r.userId + '" data-nom="' + esc(r.joueur) + '" '
      + 'style="display:block;width:100%;text-align:left;margin-bottom:6px;cursor:pointer">' + esc(r.joueur) + '</button>'
    ).join("");
    zone.querySelectorAll("[data-uid]").forEach(b => b.onclick = () => choisirCible(b.getAttribute("data-uid"), b.getAttribute("data-nom")));
  }

  function choisirCible(uid, nom) {
    cible = { userId: uid, joueur: nom };
    $("cibleNom").textContent = nom;
    $("choixCarte").style.display = "block";
    $("choixCarte").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function chargerChapitres() {
    const base = await db();
    const ent = await window.entrepriseId();
    const sel = $("selChapitre");
    const { data } = await base.from("chapitres").select("id, theme_id, nom, mots")
      .eq("entreprise_id", ent).eq("publie", true).order("nom");
    chaps = (data || []).filter(c => Array.isArray(c.mots) && c.mots.length >= 10);
    sel.innerHTML = chaps.length
      ? chaps.map(c => '<option value="' + c.id + '">' + esc(c.nom) + '</option>').join("")
      : '<option value="">Aucune grille disponible</option>';
  }

  $("btnJouerDefi").addEventListener("click", () => {
    if (!monId) { location.href = "connexion.html?retour=duel-recherche.html"; return; }
    const chapId = $("selChapitre").value;
    chapChoisi = chaps.find(c => c.id === chapId);
    if (!chapChoisi) { alert("Choisis une grille."); return; }
    lancer(chapChoisi, parseInt($("selNiveau").value, 10));
  });

  function lancer(chap, niveau) {
    const MOTS_NIV = { 1:6, 2:7, 3:8, 4:9, 5:10 };
    mesMots = melanger(chap.mots).slice(0, MOTS_NIV[niveau] || 8);

    $("ecranRecherche").style.display = "none";
    $("ecranJeu").style.display = "block";
    $("jeuTitre").textContent = chap.nom;
    $("jeuMeta").textContent = "Défi pour " + cible.joueur + " · Niveau " + niveau;

    const jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => { $("statTrouves").textContent = tr; $("statRestants").textContent = total - tr; },
      surVictoire: () => terminer(chap, niveau)
    });

    const pz = jeu.charger(mesMots, 8, null, 12);
    mesMots = pz ? pz.placements.map(p => p.mot) : mesMots;
    $("statRestants").textContent = mesMots.length;

    debut = Date.now(); fini = false;
    minuteur = setInterval(() => { if (!fini) $("chrono").textContent = fmt(Math.floor((Date.now()-debut)/1000)); }, 1000);
  }

  async function terminer(chap, niveau) {
    if (fini) return;
    fini = true;
    clearInterval(minuteur);
    const t = Math.floor((Date.now() - debut) / 1000);
    $("ecranJeu").style.display = "none";

    const duel = await window.BiZoukDuel.creer({
      chapitreId: chap.id, chapitreNom: chap.nom, niveau, mots: mesMots,
      joueur: monNom || "Un joueur", temps: t,
      destinataireId: cible.userId, destinataireNom: cible.joueur
    });

    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "duel_recherche" });

    $("resSous").textContent = duel
      ? "Ton temps (" + fmt(t) + ") est enregistré. " + cible.joueur + " verra ce défi dans ses duels."
      : "Ton temps est enregistré, mais l'envoi a rencontré un souci.";
    $("resultat").classList.add("on");
  }

  moi().then(chargerChapitres);
})();
