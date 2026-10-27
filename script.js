const API_URL = "https://script.google.com/macros/s/AKfycbxXVHHGaC5iXk3ep0XHQHAp6E5sa7zuwuxfcccwC3svJVr5MDGQqFAtCrNhYqpGu0YKfA/exec";

const $ = (id) => document.getElementById(id);
const form = $("form"), giorniBox = $("giorni"), giornoInput = $("giorno");
const tipo = () => form.elements.tipo.value;
const val = (nome) => (form.elements[nome]?.value || "").trim();
let passo = 0;

function el(tag, classe, testo) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (testo !== undefined) e.textContent = testo;
  return e;
}

function messaggio(testo, errore) {
  $("messaggio").textContent = testo;
  $("messaggio").className = errore ? "errore" : "";
}

function nota(testo, errore) {
  giorniBox.replaceChildren(el("p", errore ? "nota errore" : "nota", testo));
}

// Genitore o adulto: i campi del blocco nascosto vengono disattivati (non validati né inviati).
function aggiornaTipo() {
  document.querySelectorAll("[data-blocco]").forEach((b) => {
    const attivo = b.dataset.blocco === tipo();
    b.hidden = !attivo;
    b.querySelectorAll("input, select, textarea").forEach((c) => (c.disabled = !attivo));
  });
  aggiornaGrado();
  caricaGiorni();
}

// Il grado si chiede solo a chi ha già fatto karate.
function aggiornaGrado() {
  const esperienza = tipo() === "genitore" ? val("figlioEsperienza") : tipo() === "adulto" ? val("adultoEsperienza") : "";
  $("campoGrado").hidden = esperienza !== "Sì";
  if (esperienza !== "Sì") form.elements.grado.value = "";
}

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
    messaggio("Scegli un'opzione per continuare.", true);
    return false;
  }
  if (passo === 3) {
    if (giornoInput.value) return true;
    messaggio("Scegli un giorno per la prova.", true);
    return false;
  }
  const sezione = document.querySelector(`[data-passo="${passo}"]`);
  for (const c of sezione.querySelectorAll("input, select, textarea")) {
    if (c.disabled || c.type === "hidden" || c.closest("[hidden]")) continue;
    if (!c.checkValidity()) return c.reportValidity(), false;
  }
  return true;
}

function vai(delta) {
  if (delta > 0 && !passoValido()) return;
  passo += delta;
  mostraPasso();
  window.scrollTo(0, 0);
}

async function caricaGiorni() {
  giornoInput.value = "";
  if (!tipo()) return;

  const nascita = tipo() === "genitore" ? val("figlioNascita") : "";
  if (tipo() === "genitore" && !nascita) return nota("Inserisci la data di nascita del figlio/a per vedere i giorni disponibili.");

  nota("Caricamento…");
  try {
    const url = `${API_URL}?azione=disponibilita&tipo=${tipo()}&nascita=${encodeURIComponent(nascita)}`;
    const r = await (await fetch(url)).json();
    if (!r.ok) throw new Error(r.errore);
    disegnaGiorni(r.giorni);
  } catch (err) {
    nota(err.message || "Impossibile caricare i giorni. Riprova.", true);
  }
}

// Sul giorno compaiono solo giorno della settimana e data: i posti si leggono dal colore.
function disegnaGiorni(giorni) {
  if (!giorni.length) return nota("Al momento non ci sono giorni disponibili.");

  giorniBox.replaceChildren(...giorni.map((g) => {
    const livello = g.postiRimasti >= 3 ? "verde" : g.postiRimasti === 2 ? "giallo" : g.postiRimasti === 1 ? "rosso" : "pieno";
    const [sett, data] = g.etichetta.split(" ");

    const b = el("button", `giorno ${livello}`);
    b.type = "button";
    b.dataset.etichetta = g.etichetta;
    b.setAttribute("aria-label", `${g.etichetta}, ${livello === "pieno" ? "pieno" : g.postiRimasti + " posti"}`);
    b.append(el("span", "", sett), el("strong", "", data.slice(0, 5)));

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

function riepilogo() {
  const gruppi = tipo() === "genitore"
    ? [["Genitore", [["Nome", val("genitoreNome")], ["Cognome", val("genitoreCognome")], ["Telefono", val("genitoreTelefono")]]],
       ["Figlio/a", [["Nome", val("figlioNome")], ["Data di nascita", val("figlioNascita")], ["Ha già fatto karate", val("figlioEsperienza")], ["Accompagnatore", val("accompagnatore")], ["Note", val("figlioNote")]]]]
    : [["Dati personali", [["Nome", val("adultoNome")], ["Cognome", val("adultoCognome")], ["Telefono", val("adultoTelefono")], ["Data di nascita", val("adultoNascita")], ["Ha già fatto karate", val("adultoEsperienza")]]]];

  gruppi.push(["Contatti", [["Email", val("email")], ["Comune", val("comune")], ["Grado", val("grado")]]]);
  gruppi.push(["Prova", [["Giorno", giorniBox.querySelector(".scelto")?.dataset.etichetta || giornoInput.value]]]);

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

async function invia(evento) {
  evento.preventDefault();
  if (passo !== 4) return;

  $("invia").disabled = true;
  messaggio("Invio in corso…");
  try {
    // text/plain evita la richiesta preflight CORS, che Apps Script non gestisce.
    const r = await (await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    })).json();

    if (r.ok) {
      form.hidden = $("intro").hidden = true;
      $("successo").hidden = false;
      window.scrollTo(0, 0);
    } else {
      messaggio(r.errore || "Prenotazione non riuscita.", true);
      caricaGiorni();   // aggiorna i posti: potrebbero essersi esauriti nel frattempo
    }
  } catch (err) {
    messaggio("Connessione non riuscita. Riprova tra poco.", true);
  } finally {
    $("invia").disabled = false;
  }
}

function nuovaPrenotazione() {
  form.reset();
  form.hidden = $("intro").hidden = $("successo").hidden = false;
  $("successo").hidden = true;
  passo = 0;
  giorniBox.replaceChildren();
  aggiornaTipo();
  mostraPasso();
  window.scrollTo(0, 0);
}

form.elements.tipo.forEach((r) => r.addEventListener("change", aggiornaTipo));
form.elements.figlioNascita.addEventListener("change", caricaGiorni);
form.elements.figlioEsperienza.addEventListener("change", aggiornaGrado);
form.elements.adultoEsperienza.addEventListener("change", aggiornaGrado);
$("avanti").addEventListener("click", () => vai(1));
$("indietro").addEventListener("click", () => vai(-1));
$("chiudi").addEventListener("click", () => $("dialogo").close());
$("nuova").addEventListener("click", nuovaPrenotazione);
form.addEventListener("submit", invia);

aggiornaTipo();
mostraPasso();
