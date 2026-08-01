/* BiZouk — page Championnats (joueur) */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmtSec = s => Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");

  let monId = null, monNom = "";

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

  async function charger() {
    await moi();
    const zone = $("champZone");
    const base = await db();
    const ent = await window.entrepriseId();
    if (!base || !ent) { zone.innerHTML = "<p class='empty'>Connexion impossible.</p>"; return; }

    const { data: tournois } = await base.from("tournois").select("*").eq("entreprise_id", ent).order("created_at", { ascending: false });
    if (!tournois || !tournois.length) {
      zone.innerHTML = '<p style="text-align:center;color:var(--texte-faible);font-style:italic;padding:24px">Aucun championnat pour l\'instant. Reviens bientôt !</p>';
      return;
    }

    let html = "";
    for (const t of tournois) html += await rendreTournoi(t);
    zone.innerHTML = html;
    brancherActions();
  }

  async function rendreTournoi(t) {
    const base = await db();
    const badgeStatut = { inscriptions: "var(--violet-c)", poules: "var(--or)", eliminatoires: "var(--rose)", termine: "var(--vert)" }[t.statut] || "var(--texte-doux)";
    const nomStatut = { inscriptions: "Inscriptions ouvertes", poules: "Phase de poules", eliminatoires: "Éliminatoires", termine: "Terminé" }[t.statut] || t.statut;

    let corps = "";
    let moiInscrit = null;

    if (monId) {
      const { data } = await base.from("tournoi_joueurs").select("*").eq("tournoi_id", t.id).eq("user_id", monId).maybeSingle();
      moiInscrit = data;
    }

    if (t.statut === "inscriptions") {
      const { count } = await base.from("tournoi_joueurs").select("id", { count: "exact", head: true }).eq("tournoi_id", t.id);
      corps = '<p style="font-size:.88rem;color:var(--texte-doux);margin-bottom:12px">' + (count || 0) + ' inscrit(s)</p>'
        + (!monId
            ? '<a class="btn btn-v btn-sm" href="connexion.html?retour=championnats.html">Se connecter pour s\'inscrire</a>'
            : moiInscrit
              ? '<p style="color:var(--vert);font-weight:600;font-size:.9rem">✓ Tu es inscrit</p>'
              : '<button class="btn btn-v btn-sm" data-inscrire="' + t.id + '">S\'inscrire</button>');
    }

    if (t.statut === "poules" && moiInscrit) {
      const { data: poule } = await base.from("tournoi_joueurs").select("joueur, temps_poule_sec")
        .eq("tournoi_id", t.id).eq("poule", moiInscrit.poule).order("temps_poule_sec", { ascending: true, nullsFirst: false });
      corps = '<p style="font-size:.85rem;color:var(--texte-doux);margin-bottom:8px">Ta poule : <b>Poule ' + moiInscrit.poule + '</b></p>'
        + (moiInscrit.temps_poule_sec == null
            ? '<button class="btn btn-v btn-sm" data-jouer-poule="' + t.id + '">Jouer ta grille de poule</button>'
            : (poule || []).map((j,i) => '<div class="bord-ligne" style="border:0;padding:4px 0">'
                + '<span class="bord-nom">' + (i < t.qualifies_poule ? '🟢 ' : '') + esc(j.joueur) + '</span>'
                + '<span class="bord-val">' + (j.temps_poule_sec != null ? fmtSec(j.temps_poule_sec) : '—') + '</span></div>').join(""));
    } else if (t.statut === "poules" && !moiInscrit) {
      corps = '<p class="hint">Tu n\'étais pas inscrit avant le lancement des poules.</p>';
    }

    if (t.statut === "eliminatoires") {
      if (!monId) { corps = '<p class="hint">Connecte-toi pour voir ta progression.</p>'; }
      else {
        const { data: mesMatchs } = await base.from("tournoi_matchs").select("*").eq("tournoi_id", t.id)
          .or("joueur1_id.eq." + monId + ",joueur2_id.eq." + monId).order("created_at", { ascending: false });
        const enCours = (mesMatchs || []).find(m => m.statut === "a_jouer");
        const dernier = (mesMatchs || [])[0];

        if (enCours) {
          corps = '<p style="font-size:.88rem;margin-bottom:10px">Ton match : <b>' + esc(enCours.joueur1_nom) + '</b> vs <b>' + esc(enCours.joueur2_nom || "adversaire") + '</b></p>'
            + '<a class="btn btn-v btn-sm" href="tournoi-match.html?match=' + enCours.id + '">Jouer ton match</a>';
        } else if (dernier && dernier.statut === "termine" && dernier.gagnant_id !== monId) {
          corps = '<p style="color:var(--texte-faible);font-style:italic">Éliminé cette édition. Merci d\'avoir participé !</p>';
        } else if (dernier && dernier.statut === "termine" && dernier.gagnant_id === monId) {
          corps = '<p style="color:var(--vert);font-weight:600">Tu es toujours en lice. En attente du prochain tour.</p>';
        } else {
          corps = '<p class="hint">Tu n\'as pas participé à ce championnat.</p>';
        }
      }
      corps += '<button type="button" class="btn btn-g btn-sm" style="margin-top:12px" data-voir-tableau="' + t.id + '">Voir le tableau éliminatoire</button>'
        + '<div id="tableau-' + t.id + '" style="margin-top:12px;display:none"></div>';
    }

    if (t.statut === "termine") {
      corps += '<button type="button" class="btn btn-g btn-sm" style="margin-top:10px" data-voir-tableau="' + t.id + '">Voir le tableau éliminatoire</button>'
        + '<div id="tableau-' + t.id + '" style="margin-top:12px;display:none"></div>';
    }

    if (t.statut === "termine") {
      const jaiGagne = monId && t.gagnant_id === monId;
      corps = '<p style="font-size:.92rem">🏆 <b style="color:var(--or)">' + esc(t.gagnant_nom || "—") + '</b> remporte « ' + esc(t.badge_nom) + ' »</p>'
        + (jaiGagne
            ? (t.recompense_reclamee
                ? '<p style="color:var(--vert);font-weight:600;font-size:.9rem;margin-top:8px">✓ Récompense réclamée</p>'
                : '<button class="btn btn-v btn-sm" style="margin-top:10px" data-reclamer="' + t.id + '">Réclamer tes ' + t.recompense_pierres + ' pierres + ton badge</button>')
            : '');
    }

    return '<div class="form-carte" style="margin-bottom:18px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      + '<h2 style="font-family:var(--serif);font-size:1.15rem;color:var(--blanc);margin:0">' + esc(t.nom) + '</h2>'
      + '<span style="font-size:.74rem;font-weight:700;color:' + badgeStatut + '">' + nomStatut + '</span>'
      + '</div>' + corps + '</div>';
  }

  function brancherActions() {
    document.querySelectorAll("[data-inscrire]").forEach(b => b.onclick = () => inscrire(b.getAttribute("data-inscrire")));
    document.querySelectorAll("[data-jouer-poule]").forEach(b => b.onclick = () =>
      location.href = "tournoi-poule.html?tournoi=" + b.getAttribute("data-jouer-poule"));
    document.querySelectorAll("[data-reclamer]").forEach(b => b.onclick = () => reclamer(b.getAttribute("data-reclamer"), b));
    document.querySelectorAll("[data-voir-tableau]").forEach(b => b.onclick = () => afficherTableau(b.getAttribute("data-voir-tableau"), b));
  }

  async function afficherTableau(tournoiId, bouton) {
    const zone = $("tableau-" + tournoiId);
    if (!zone) return;
    if (zone.style.display !== "none") { zone.style.display = "none"; bouton.textContent = "Voir le tableau éliminatoire"; return; }

    zone.innerHTML = '<p style="text-align:center;color:var(--texte-faible);font-style:italic">Chargement…</p>';
    zone.style.display = "block";
    bouton.textContent = "Masquer le tableau";

    const base = await db();
    const { data: matchs } = await base.from("tournoi_matchs").select("*").eq("tournoi_id", tournoiId).order("created_at");
    if (!matchs || !matchs.length) { zone.innerHTML = '<p class="hint">Pas encore de match généré.</p>'; return; }

    const parRonde = {};
    matchs.forEach(m => { (parRonde[m.ronde] = parRonde[m.ronde] || []).push(m); });

    zone.innerHTML = Object.keys(parRonde).map(ronde =>
      '<div style="margin-bottom:14px">'
      + '<div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--violet-c);margin-bottom:6px">' + esc(ronde) + '</div>'
      + parRonde[ronde].map(m => {
          const j1Gagne = m.statut === "termine" && m.gagnant_id === m.joueur1_id;
          const j2Gagne = m.statut === "termine" && m.gagnant_id === m.joueur2_id;
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;'
            + 'background:var(--gris-2);border:1px solid var(--gris-line);border-radius:10px;padding:9px 12px;margin-bottom:6px;font-size:.86rem">'
            + '<span style="' + (j1Gagne ? 'color:var(--vert);font-weight:700' : '') + '">' + esc(m.joueur1_nom || "?") + (j1Gagne ? ' 🏆' : '') + '</span>'
            + '<span style="color:var(--texte-faible);font-size:.76rem">vs</span>'
            + '<span style="' + (j2Gagne ? 'color:var(--vert);font-weight:700' : '') + '">' + esc(m.joueur2_nom || "(bye)") + (j2Gagne ? ' 🏆' : '') + '</span>'
            + '</div>';
        }).join("")
      + '</div>'
    ).join("");
  }

  async function inscrire(tournoiId) {
    if (!monId) { location.href = "connexion.html?retour=championnats.html"; return; }
    const base = await db();
    const nom = monNom || "Joueur";
    const { error } = await base.from("tournoi_joueurs").insert({ tournoi_id: tournoiId, user_id: monId, joueur: nom });
    if (error) { alert("Inscription impossible : " + error.message); return; }
    charger();
  }

  async function reclamer(tournoiId, bouton) {
    bouton.disabled = true; bouton.textContent = "Réclamation…";
    const base = await db();
    const { data: t } = await base.from("tournois").select("*").eq("id", tournoiId).single();
    if (!t || t.recompense_reclamee) return;

    if (window.Progression) {
      await window.Progression.init();
      await window.Progression.ajouterBadge(t.badge_nom, t.recompense_pierres);
    }
    await base.from("tournois").update({ recompense_reclamee: true }).eq("id", tournoiId);
    charger();
  }

  charger();
})();
