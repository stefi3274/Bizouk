/* BiZouk — proposer un thème */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const msg = (t, k) => { const e = $("msg"); if(!e) return; e.textContent = t; e.className = "msg on " + (k||""); };

  function normaliser(m) {
    return (m||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z]/g,"");
  }
  function compter(txt) {
    return [...new Set((txt||"").split(/[\n,;]+/).map(normaliser).filter(m => m.length >= 2))].length;
  }

  const ta = $("cMots");
  if (ta) ta.addEventListener("input", () => {
    const n = compter(ta.value);
    const c = $("cCompteur");
    if (c) {
      c.textContent = n + (n > 1 ? " mots" : " mot");
      const bon = n >= 35, ok = n >= 20;
      c.style.background = bon ? "rgba(52,211,153,.2)" : (ok ? "rgba(240,180,41,.2)" : "var(--violet-glow)");
      c.style.color = bon ? "#6ee7b7" : (ok ? "#fbbf24" : "var(--violet-c)");
    }
  });

  const btn = $("cEnvoyer");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const nom = ($("cNom").value||"").trim();
    const contact = ($("cContact").value||"").trim();
    const theme = ($("cTheme").value||"").trim();
    const chapitre = ($("cChapitre").value||"").trim();
    const mots = ($("cMots").value||"").trim();

    if (nom.length < 2) { msg("Indique ton nom.", "err"); return; }
    if (!contact) { msg("Indique un moyen de te recontacter.", "err"); return; }
    if (theme.length < 2) { msg("Donne un nom au thème.", "err"); return; }
    const n = compter(mots);
    if (n < 20) { msg("Il faut au moins 20 mots (tu en as " + n + ").", "err"); return; }

    const base = await db();
    if (!base) { msg("Service indisponible. Écris-nous par email.", "err"); return; }

    msg("Envoi en cours…");
    btn.disabled = true;
    const ent = await entrepriseId();
    if (!ent) { msg("Erreur de configuration. Écris-nous par email.", "err"); btn.disabled = false; return; }

    const { error } = await base.from("bizouk_contributions").insert({
      entreprise_id: ent, auteur: nom, contact: contact,
      theme: theme, chapitre: chapitre || null, mots: mots, statut: "a_verifier"
    });

    btn.disabled = false;
    if (error) { msg("Erreur : " + error.message, "err"); return; }

    msg("Merci ! Ta proposition a bien été reçue. Nous la vérifions avant publication.", "ok");
    $("cNom").value = ""; $("cContact").value = ""; $("cTheme").value = "";
    $("cChapitre").value = ""; $("cMots").value = "";
    $("cCompteur").textContent = "0 mot";
  });
})();
