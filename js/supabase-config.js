/* Configuration Supabase — BiZouk
   Initialisation résiliente : réessaie si la librairie tarde à charger. */
const SUPABASE_URL = "https://darzhfamxnycdglcglgg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhcnpoZmFteG55Y2RnbGNnbGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDUzNjcsImV4cCI6MjA5NTkyMTM2N30.uHMDHR4df8oYGIqLonLwAgEDzzdu1s7yj7VWtp3KUBQ";
const SLUG = "bizouk";

let DB = null;
let PRET = false;

function initSupabase() {
  if (DB) return true;
  try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      DB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.DB = DB;
      PRET = true;
      return true;
    }
  } catch (e) {
    console.warn("Supabase : echec d'initialisation", e);
  }
  return false;
}

// Tentative immediate
initSupabase();

// Si la librairie n'etait pas prete, on reessaie plusieurs fois
if (!DB) {
  let essais = 0;
  const minuteur = setInterval(() => {
    essais++;
    if (initSupabase() || essais > 40) {
      clearInterval(minuteur);
      if (DB) document.dispatchEvent(new CustomEvent("supabase-pret"));
    }
  }, 200);
  window.addEventListener("load", initSupabase);
}

/* Attend que la connexion soit prete */
function attendreDB(maxMs) {
  const limite = maxMs || 8000;
  return new Promise(resolve => {
    if (initSupabase()) return resolve(DB);
    const debut = Date.now();
    const t = setInterval(() => {
      if (initSupabase()) { clearInterval(t); resolve(DB); }
      else if (Date.now() - debut > limite) { clearInterval(t); resolve(null); }
    }, 150);
  });
}
window.attendreDB = attendreDB;

/* Recupere l'id de l'entreprise BiZouk */
let _entId = null;
async function entrepriseId() {
  if (_entId) return _entId;
  const db = DB || await attendreDB(6000);
  if (!db) return null;
  const { data, error } = await db.from("entreprises").select("id").eq("slug", SLUG).maybeSingle();
  if (error) { console.warn("entrepriseId :", error.message); return null; }
  _entId = data ? data.id : null;
  return _entId;
}
window.entrepriseId = entrepriseId;
