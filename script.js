// Incolla qui l'URL dell'app web di Apps Script (Distribuisci → Gestisci distribuzioni).
const API_URL = "INCOLLA_QUI_L_URL_DELL_APP_WEB";

const form = document.getElementById("form");
const giorniBox = document.getElementById("giorni");
const giornoInput = document.getElementById("giorno");
const messaggio = document.getElementById("messaggio");
const bottone = document.getElementById("invia");
const dialogo = document.getElementById("dialogo");

const tipo = () => form.elements.tipo.value;

function mostraMessaggio(testo, errore) {
  messaggio.textContent = testo;
  messaggio.className = errore ? "errore" : "";
}

function nota(testo, classe) {
  const p = document.createElement("p");
  p.className = classe || "nota";
  p.textContent = testo;
  giorniBox.replaceChildren(p);
}

// Mostra il blocco del genitore o dell'adulto; i campi nascosti vengono disattivati
// così non vengono validati né inviati.
function aggiornaBlocchi() {
  document.getElementById("dopo").hidden = !tipo();
  document.querySelectorAll("[data-blocco]").forEach((blocco) => {
    const attivo = blocco.dataset.blocco === tipo();
    blocco.hidden = !attivo;
    blocco.querySelectorAll("input, select, textarea").forEach((c) => (c.disabled = !attivo));
  });
  caricaGiorni();
}

async function caricaGiorni() {
  giornoInput.value = "";
  if (!tipo()) return;

  const nascita = tipo() === "genitore" ? form.elements.figlioNascita.value : "";
  if (tipo() === "genitore" && !nascita) {
    return nota("Inserisci la data di nascita del figlio/a per vedere i giorni disponibili.");
  }

  nota("Caricamento dei giorni…");
  try {
    const url = `${API_URL}?azione=disponibilita&tipo=${tipo()}&nascita=${encodeURIComponent(nascita)}`;
    const risposta = await (await fetch(url)).json();
    if (!risposta.ok) throw new Error(risposta.errore);
    disegnaGiorni(risposta.giorni);
  } catch (err) {
    nota(err.message || "Impossibile caricare i giorni. Riprova.", "errore");
  }
}

function disegnaGiorni(giorni) {
  if (!giorni.length) return nota("Al momento non ci sono giorni disponibili.");

  const bottoni = giorni.map((g) => {
    const livello = g.postiRimasti >= 3 ? "verde" : g.postiRimasti === 2 ? "giallo" : g.postiRimasti === 1 ? "rosso" : "pieno";
    const testoPosti = { verde: `${g.postiRimasti} posti`, giallo: "2 posti", rosso: "ultimo posto", pieno: "Pieno" }[livello];

    const b = document.createElement("button");
    b.type = "button";
    b.className = `giorno ${livello}`;
    b.dataset.data = g.data;
    if (livello === "pieno") b.setAttribute("aria-disabled", "true");

    const titolo = document.createElement("strong");
    titolo.textContent = g.etichetta;
    const dettaglio = document.createElement("span");
    dettaglio.textContent = `${g.corso} · ${g.orario}`;
    const posti = document.createElement("small");
    posti.textContent = testoPosti;
    b.append(titolo, dettaglio, posti);

    b.addEventListener("click", () => {
      if (livello === "pieno") return dialogo.showModal();   // giorno pieno: non selezionabile
      giorniBox.querySelectorAll(".giorno").forEach((x) => x.classList.remove("scelto"));
      b.classList.add("scelto");
      giornoInput.value = g.data;
      mostraMessaggio("");
    });
    return b;
  });

  giorniBox.replaceChildren(...bottoni);
}

async function invia(evento) {
  evento.preventDefault();
  if (!form.reportValidity()) return;
  if (!giornoInput.value) return mostraMessaggio("Scegli un giorno per la prova.", true);

  bottone.disabled = true;
  mostraMessaggio("Invio in corso…");

  try {
    const dati = Object.fromEntries(new FormData(form));
    // text/plain evita la richiesta "preflight" CORS, che Apps Script non gestisce.
    const risposta = await (await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(dati)
    })).json();

    if (risposta.ok) {
      document.getElementById("dettagli").textContent =
        `${risposta.data} · ${risposta.corso} (${risposta.orario})`;
      form.hidden = true;
      document.getElementById("successo").hidden = false;
      window.scrollTo(0, 0);
    } else {
      mostraMessaggio(risposta.errore || "Prenotazione non riuscita.", true);
      caricaGiorni();   // aggiorna i posti: potrebbe essersi riempito nel frattempo
    }
  } catch (err) {
    mostraMessaggio("Connessione non riuscita. Riprova tra poco.", true);
  } finally {
    bottone.disabled = false;
  }
}

form.elements.tipo.forEach((r) => r.addEventListener("change", aggiornaBlocchi));
form.elements.figlioNascita.addEventListener("change", caricaGiorni);
form.addEventListener("submit", invia);
document.getElementById("chiudi").addEventListener("click", () => dialogo.close());
aggiornaBlocchi();
