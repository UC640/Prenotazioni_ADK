const API_URL = "https://script.google.com/macros/s/AKfycbxXVHHGaC5iXk3ep0XHQHAp6E5sa7zuwuxfcccwC3svJVr5MDGQqFAtCrNhYqpGu0YKfA/exec";

const $ = (id) => document.getElementById(id);
const form = $("form"), giorniBox = $("giorni"), giornoInput = $("giorno");

let passo = 0;
let richiesta = 0;   // numero dell'ultima richiesta di disponibilità: scarta le risposte superate

const el = (tag, classe, testo) => {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (testo !== undefined) e.textContent = testo;
  return e;
};

const messaggio = (testo, errore = false) => {
  $("messaggio").textContent = testo;
  $("messaggio").className = errore ? "errore" : "";
};

const nota = (testo, errore = false) =>
  giorniBox.replaceChildren(el("p", errore ? "nota errore" : "nota", testo));

const tipo = () => form.querySelector('input[name="tipo"]:checked')?.value || "";

// Valore del primo campo ATTIVO con quel nome: i campi del percorso non scelto sono disabilitati.
function val(nome) {
  for (const c of form.querySelectorAll(`[name="${nome}"]`)) {
    if (!c.disabled && c.type !== "hidden") return c.value.trim();
  }
  return "";
}

// ---------- Percorso genitore / adulto ----------

function aggiornaTipo() {
  document.querySelectorAll("[data-blocco]").forEach((b) => {
    const attivo = b.dataset.blocco === tipo();
    b.hidden = !attivo;
    b.querySelectorAll("input, select, textarea").forEach((c) => (c.disabled = !attivo));
  });
  aggiornaGrado();
}

// Il grado compare solo se la risposta sull'esperienza è "Sì".
function aggiornaGrado() {
  const percorso = tipo();
  if (!percorso) return;

  const genitore = percorso === "genitore";
  const contenitore = $(genitore ? "campoGradoBambino" : "campoGradoAdulto");
  const mostra = val(genitore ? "figlioEsperienza" : "adultoEsperienza") === "Sì";
  const grado = contenitore.querySelector('input[name="grado"]');

  contenitore.hidden = !mostra;
  grado.disabled = !mostra;
  if (!mostra) grado.value = "";
}

// ---------- Navigazione ----------

function mostraPasso() {
  $("dopo").hidden = !tipo();
  document.querySelectorAll("[data-passo]").forEach((s) => (s.hidden = Number(s.dataset.passo) !== passo));

  $("indietro").hidden = passo === 0;
  $("avanti").hidden = passo === 4;
  $("invia").hidden = passo !== 4;

  messaggio("");
  if (passo === 3) caricaGiorni();
  if (passo === 4) riepilogo();
}

function passoValido() {
  if (passo === 0) {
    if (tipo()) return true;
    messaggio("Scegli se prenoti per tuo figlio/a oppure per te.", true);
    return false;
  }

  const sezione = document.querySelector(`[data-passo="${passo}"]`);
  for (const c of sezione.querySelectorAll("input, select, textarea")) {
    if (c.disabled || c.type === "hidden" || c.closest("[hidden]")) continue;
    if (!c.checkValidity()) {
      c.reportValidity();
      return false;
    }
  }

  if (passo === 3 && !giornoInput.value) {
    messaggio("Scegli un giorno per la prova.", true);
    return false;
  }
  return true;
}

function vai(delta) {
  if (delta > 0 && !passoValido()) return;
  const nuovo = passo + delta;
  if (nuovo < 0 || nuovo > 4) return;

  passo = nuovo;
  mostraPasso();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Giorni disponibili ----------

async function caricaGiorni() {
  const numero = ++richiesta;
  giornoInput.value = "";

  if (!tipo()) return giorniBox.replaceChildren();

  // Per i bambini la disponibilità dipende dalla data di nascita.
  const nascita = tipo() === "genitore" ? val("figlioNascita") : "";
  if (tipo() === "genitore" && !nascita) {
    return nota("Inserisci la data di nascita del bambino/a per vedere i giorni disponibili.");
  }

  nota("Caricamento dei giorni disponibili…");

  try {
    const url = `${API_URL}?azione=disponibilita&tipo=${encodeURIComponent(tipo())}&nascita=${encodeURIComponent(nascita)}`;
    const r = await (await fetch(url)).json();
    if (numero !== richiesta) return;
    if (!r.ok) throw new Error(r.errore || "Disponibilità non disponibile.");
    disegnaGiorni(r.giorni || []);
  } catch (err) {
    if (numero === richiesta) nota(err.message || "Impossibile caricare i giorni. Riprova.", true);
  }
}

// Sul giorno compaiono solo giorno della settimana e data: i posti si leggono dal colore.
function disegnaGiorni(giorni) {
  if (!giorni.length) return nota("Al momento non ci sono giorni disponibili.");

  giorniBox.replaceChildren(...giorni.map((g) => {
    const livello = g.postiRimasti >= 3 ? "verde" : g.postiRimasti === 2 ? "giallo" : g.postiRimasti === 1 ? "rosso" : "pieno";
    const etichetta = g.etichetta || g.data;
    const parti = etichetta.split(" ");

    const b = el("button", `giorno ${livello}`);
    b.type = "button";
    b.dataset.etichetta = etichetta;
    b.setAttribute("aria-label", `${etichetta}, ${livello === "pieno" ? "turno pieno" : g.postiRimasti + " posti disponibili"}`);
    b.append(el("span", "", parti[0] || ""), el("strong", "", parti.slice(1).join(" ").slice(0, 5)));
    if (livello === "pieno") b.setAttribute("aria-disabled", "true");

    b.addEventListener("click", () => {
      if (livello === "pieno") return $("dialogo").showModal();
      giorniBox.querySelectorAll(".giorno").forEach((x) => x.classList.remove("scelto"));
      b.classList.add("scelto");
      giornoInput.value = g.data;
      messaggio("");
    });
    return b;
  }));
}

// ---------- Riepilogo ----------

function riepilogo() {
  const gruppi = [];

  if (tipo() === "genitore") {
    const esperienza = val("figlioEsperienza");
    gruppi.push(
      ["Dati del genitore", [
        ["Nome", val("genitoreNome")], ["Cognome", val("genitoreCognome")],
        ["Comune di residenza", val("comune")], ["Telefono", val("genitoreTelefono")], ["Email", val("email")]
      ]],
      ["Dati del bambino/a", [["Nome", val("figlioNome")], ["Data di nascita", val("figlioNascita")]]],
      ["Informazioni sul bambino/a", [
        ["Ha già fatto karate", esperienza],
        ...(esperienza === "Sì" ? [["Grado", val("grado")]] : []),
        ["Accompagnatore", val("accompagnatore")], ["Note", val("figlioNote")]
      ]]
    );
  } else if (tipo() === "adulto") {
    const esperienza = val("adultoEsperienza");
    gruppi.push(
      ["Dati personali", [
        ["Nome", val("adultoNome")], ["Cognome", val("adultoCognome")], ["Data di nascita", val("adultoNascita")],
        ["Comune di residenza", val("comune")], ["Telefono", val("adultoTelefono")], ["Email", val("email")]
      ]],
      ["Esperienza nel karate", [
        ["Ha già fatto karate", esperienza],
        ...(esperienza === "Sì" ? [["Grado", val("grado")]] : [])
      ]]
    );
  }

  gruppi.push(["Giorno della prova", [
    ["Giorno selezionato", giorniBox.querySelector(".giorno.scelto")?.dataset.etichetta || giornoInput.value]
  ]]);

  const box = $("riepilogo");
  box.replaceChildren();
  gruppi.forEach(([titolo, righe]) => {
    box.append(el("h3", "", titolo));
    righe.forEach(([nome, valore]) => {
      const riga = el("dl");
      riga.append(el("dt", "", nome), el("dd", "", valore || "—"));
      box.append(riga);
    });
  });
}

// ---------- Invio ----------

async function invia(evento) {
  evento.preventDefault();
  if (passo !== 4) return;

  if (!giornoInput.value) {
    return messaggio("Torna alla scelta del giorno e seleziona una disponibilità.", true);
  }

  $("invia").disabled = true;
  messaggio("Invio della prenotazione in corso…");

  try {
    // FormData include solo i campi attivi. text/plain evita il preflight CORS, che Apps Script non gestisce.
    const r = await (await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    })).json();

    if (r.ok) {
      form.hidden = true;
      $("intro").hidden = true;
      $("successo").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      messaggio(r.errore || "Prenotazione non riuscita. Riprova.", true);
      caricaGiorni();   // aggiorna i posti: il turno potrebbe essersi riempito nel frattempo
    }
  } catch (err) {
    messaggio("Connessione non riuscita. Riprova tra poco.", true);
  } finally {
    $("invia").disabled = false;
  }
}

function nuovaPrenotazione() {
  richiesta++;
  form.reset();
  form.hidden = false;
  $("intro").hidden = false;
  $("successo").hidden = true;

  passo = 0;
  giornoInput.value = "";
  giorniBox.replaceChildren();
  $("riepilogo").replaceChildren();
  messaggio("");

  aggiornaTipo();
  mostraPasso();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Eventi ----------

form.querySelectorAll('input[name="tipo"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    richiesta++;

    // Svuota i campi del percorso non scelto (i nomi dei campi restano quelli del backend).
    document.querySelectorAll("[data-blocco]").forEach((b) => {
      if (b.dataset.blocco !== tipo()) {
        b.querySelectorAll("input, select, textarea").forEach((c) => (c.value = ""));
      }
    });

    giornoInput.value = "";
    giorniBox.replaceChildren();
    aggiornaTipo();
    mostraPasso();
  });
});

form.elements.figlioEsperienza.addEventListener("change", aggiornaGrado);
form.elements.adultoEsperienza.addEventListener("change", aggiornaGrado);
$("avanti").addEventListener("click", () => vai(1));
$("indietro").addEventListener("click", () => vai(-1));
$("chiudi").addEventListener("click", () => $("dialogo").close());
$("nuova").addEventListener("click", nuovaPrenotazione);
form.addEventListener("submit", invia);

// ---------- Avvio ----------

// Le date di nascita non possono essere nel futuro.
const oggi = new Date().toLocaleDateString("sv-SE");   // formato aaaa-mm-gg, nel fuso del dispositivo
form.querySelectorAll('input[type="date"]').forEach((c) => (c.max = oggi));

aggiornaTipo();
mostraPasso();
