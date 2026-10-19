const API_URL = "https://script.google.com/macros/s/AKfycbxXVHHGaC5iXk3ep0XHQHAp6E5sa7zuwuxfcccwC3svJVr5MDGQqFAtCrNhYqpGu0YKfA/exec";

const form = document.getElementById("form");
const giorniBox = document.getElementById("giorni");
const giornoInput = document.getElementById("giorno");
const messaggio = document.getElementById("messaggio");
const bottoneAvanti = document.getElementById("avanti");
const bottoneIndietro = document.getElementById("indietro");
const bottoneInvia = document.getElementById("invia");
const dialogo = document.getElementById("dialogo");

const fasi = [...document.querySelectorAll(".fase")];
const totaleFasi = fasi.length;

let faseCorrente = 0;
let richiestaGiorni = 0;

const tipo = () => form.elements.tipo.value;

function mostraMessaggio(testo = "", errore = false) {
  messaggio.textContent = testo;
  messaggio.className = errore ? "errore" : "";
}

function nota(testo, classe = "nota") {
  const p = document.createElement("p");
  p.className = classe;
  p.textContent = testo;
  giorniBox.replaceChildren(p);
}

function campo(nome) {
  return form.elements.namedItem(nome);
}

/* ATTIVA O DISATTIVA I CAMPI */

function disattivaBlocco(blocco, disattiva) {
  blocco.querySelectorAll("input, select, textarea").forEach((elemento) => {
    elemento.disabled = disattiva;
  });
}

function aggiornaBlocchi() {
  const scelta = tipo();

  document.querySelectorAll("[data-blocco]").forEach((blocco) => {
    const attivo = blocco.dataset.blocco === scelta;

    blocco.hidden = !attivo;
    disattivaBlocco(blocco, !attivo);
  });

  aggiornaCondizionali();
}

/* CAMPI CONDIZIONALI */

function aggiornaCondizionali() {
  document.querySelectorAll("[data-condizionale]").forEach((contenitore) => {
    const nomeCampo = contenitore.dataset.condizionale;
    const valoreRichiesto = contenitore.dataset.valore;
    const controllo = campo(nomeCampo);

    let visibile = Boolean(controllo && controllo.value === valoreRichiesto);

    // Non mostrare campi condizionali appartenenti a un blocco inattivo.
    const bloccoPadre = contenitore.closest("[data-blocco]");

    if (bloccoPadre && bloccoPadre.hidden) {
      visibile = false;
    }

    contenitore.hidden = !visibile;

    contenitore.querySelectorAll("input, select, textarea").forEach((elemento) => {
      elemento.disabled = !visibile;

      if (!visibile) {
        elemento.value = "";
      }
    });
  });
}

/* NAVIGAZIONE */

function aggiornaInterfaccia() {
  fasi.forEach((fase, indice) => {
    fase.hidden = indice !== faseCorrente;
    fase.classList.toggle("attiva", indice === faseCorrente);
  });

  const nomiFasi = [
    "Iniziamo",
    "I tuoi dati",
    "Contatti",
    "Scegli il giorno",
    "Riepilogo"
  ];

  document.getElementById("nomeFase").textContent = nomiFasi[faseCorrente];
  document.getElementById("numeroFase").textContent =
    `Passaggio ${faseCorrente + 1} di ${totaleFasi}`;

  document.getElementById("barra").style.width =
    `${((faseCorrente + 1) / totaleFasi) * 100}%`;

  bottoneIndietro.hidden = faseCorrente === 0;
  bottoneAvanti.hidden = faseCorrente === totaleFasi - 1;
  bottoneInvia.hidden = faseCorrente !== totaleFasi - 1;

  mostraMessaggio();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function controllaFase() {
  const fase = fasi[faseCorrente];

  const campi = [...fase.querySelectorAll("input, select, textarea")];

  for (const elemento of campi) {
    if (
      elemento.disabled ||
      elemento.type === "hidden" ||
      elemento.name === "giorno" ||
      elemento.name === "trappola"
    ) {
      continue;
    }

    if (!elemento.checkValidity()) {
      elemento.reportValidity();
      elemento.focus();
      return false;
    }
  }

  return true;
}

async function vaiAvanti() {
  if (!controllaFase()) return;

  if (faseCorrente === 0) {
    aggiornaBlocchi();
  }

  if (faseCorrente === 3 && !giornoInput.value) {
    mostraMessaggio("Seleziona un giorno per la tua prova.", true);
    return;
  }

  if (faseCorrente < totaleFasi - 1) {
    faseCorrente++;

    if (faseCorrente === 3) {
      await caricaGiorni();
    }

    if (faseCorrente === 4) {
      creaRiepilogo();
    }

    aggiornaInterfaccia();
  }
}

function vaiIndietro() {
  if (faseCorrente > 0) {
    faseCorrente--;
    aggiornaInterfaccia();
  }
}

/* DISPONIBILITÀ DEI GIORNI */

async function caricaGiorni() {
  const idRichiesta = ++richiestaGiorni;

  giornoInput.value = "";
  giorniBox.querySelectorAll(".giorno").forEach((b) => {
    b.classList.remove("scelto");
  });

  const scelta = tipo();

  if (!scelta) {
    return nota("Prima seleziona chi parteciperà.");
  }

  const nascita =
    scelta === "genitore" ? campo("figlioNascita").value : "";

  if (scelta === "genitore" && !nascita) {
    return nota("Inserisci la data di nascita del figlio/a per vedere i giorni disponibili.");
  }

  nota("Caricamento dei giorni…");

  try {
    const url =
      `${API_URL}?azione=disponibilita` +
      `&tipo=${encodeURIComponent(scelta)}` +
      `&nascita=${encodeURIComponent(nascita)}`;

    const response = await fetch(url);
    const risposta = await response.json();

    // Ignora le risposte superate da richieste più recenti.
    if (idRichiesta !== richiestaGiorni) return;

    if (!risposta.ok) {
      throw new Error(risposta.errore || "Impossibile caricare i giorni.");
    }

    disegnaGiorni(risposta.giorni || []);

  } catch (errore) {
    if (idRichiesta !== richiestaGiorni) return;

    nota(
      errore.message || "Impossibile caricare i giorni. Riprova.",
      "errore"
    );
  }
}

function disegnaGiorni(giorni) {
  if (!giorni.length) {
    return nota("Al momento non ci sono giorni disponibili.");
  }

  const frammento = document.createDocumentFragment();

  giorni.forEach((g) => {
    const rimasti = Number(g.postiRimasti);

    let livello;
    let testoPosti;

    if (rimasti <= 0) {
      livello = "pieno";
      testoPosti = "Completo";
    } else if (rimasti === 1) {
      livello = "rosso";
      testoPosti = "Ultimo posto";
    } else if (rimasti === 2) {
      livello = "giallo";
      testoPosti = "2 posti";
    } else {
      livello = "verde";
      testoPosti = `${rimasti} posti`;
    }

    const bottone = document.createElement("button");
    bottone.type = "button";
    bottone.className = `giorno ${livello}`;
    bottone.dataset.data = g.data;

    if (livello === "pieno") {
      bottone.setAttribute("aria-disabled", "true");
      bottone.setAttribute("aria-label", `${g.etichetta}, turno completo`);
    } else {
      bottone.setAttribute(
        "aria-label",
        `${g.etichetta}, ${testoPosti} disponibili`
      );
    }

    const titolo = document.createElement("strong");
    titolo.textContent = g.etichetta;

    const posti = document.createElement("small");
    posti.textContent = testoPosti;

    bottone.append(titolo, posti);

    bottone.addEventListener("click", () => {
      if (livello === "pieno") {
        dialogo.showModal();
        return;
      }

      giorniBox.querySelectorAll(".giorno").forEach((elemento) => {
        elemento.classList.remove("scelto");
        elemento.setAttribute("aria-pressed", "false");
      });

      bottone.classList.add("scelto");
      bottone.setAttribute("aria-pressed", "true");

      giornoInput.value = g.data;

      mostraMessaggio();
    });

    frammento.appendChild(bottone);
  });

  giorniBox.replaceChildren(frammento);
}

/* RIEPILOGO */

function valore(nome) {
  const elemento = campo(nome);

  if (!elemento || elemento.disabled) return "";

  return String(elemento.value || "").trim();
}

function aggiungiGruppo(contenitore, titolo, righe) {
  const gruppo = document.createElement("section");
  gruppo.className = "riepilogo-gruppo";

  const intestazione = document.createElement("h3");
  intestazione.textContent = titolo;
  gruppo.appendChild(intestazione);

  righe.forEach(([etichetta, testo]) => {
    if (!testo) return;

    const riga = document.createElement("div");
    riga.className = "riepilogo-riga";

    const nome = document.createElement("span");
    nome.textContent = etichetta;

    const valoreCampo = document.createElement("span");
    valoreCampo.textContent = testo;

    riga.append(nome, valoreCampo);
    gruppo.appendChild(riga);
  });

  contenitore.appendChild(gruppo);
}

function creaRiepilogo() {
  const contenitore = document.getElementById("riepilogo");
  contenitore.replaceChildren();

  const scelta = tipo();

  if (scelta === "genitore") {
    aggiungiGruppo(contenitore, "Genitore", [
      ["Nome", valore("genitoreNome")],
      ["Cognome", valore("genitoreCognome")],
      ["Telefono", valore("genitoreTelefono")]
    ]);

    aggiungiGruppo(contenitore, "Figlio/a", [
      ["Nome", valore("figlioNome")],
      ["Data di nascita", valore("figlioNascita")],
      ["Esperienza nel karate", valore("figlioEsperienza")],
      ["Grado", valore("gradoFiglio")],
      ["Accompagnatore", valore("accompagnatore")],
      ["Note", valore("figlioNote")]
    ]);

  } else {
    aggiungiGruppo(contenitore, "Dati personali", [
      ["Nome", valore("adultoNome")],
      ["Cognome", valore("adultoCognome")],
      ["Telefono", valore("adultoTelefono")],
      ["Data di nascita", valore("adultoNascita")],
      ["Esperienza nel karate", valore("adultoEsperienza")],
      ["Grado", valore("grado")]
    ]);
  }

  aggiungiGruppo(contenitore, "Contatti", [
    ["Email", valore("email")],
    ["Comune", valore("comune")]
  ]);

  const giornoSelezionato = giornoInput.value;

  const schedaGiorno = document.createElement("div");
  schedaGiorno.className = "riepilogo-data";

  const etichetta = document.createElement("strong");
  etichetta.textContent = "Giorno scelto";

  const data = document.createElement("div");

  const bottoneSelezionato = giorniBox.querySelector(".giorno.scelto");
  data.textContent = bottoneSelezionato
    ? bottoneSelezionato.querySelector("strong").textContent
    : giornoSelezionato;

  schedaGiorno.append(etichetta, data);
  contenitore.appendChild(schedaGiorno);
}

/* INVIO PRENOTAZIONE */

async function invia(evento) {
  evento.preventDefault();

  if (!controllaFase()) return;

  if (!giornoInput.value) {
    mostraMessaggio("Seleziona un giorno per la tua prova.", true);
    faseCorrente = 3;
    aggiornaInterfaccia();
    return;
  }

  if (campo("trappola").value) {
    mostraMessaggio("Impossibile elaborare la richiesta.", true);
    return;
  }

  bottoneInvia.disabled = true;
  bottoneAvanti.disabled = true;
  bottoneIndietro.disabled = true;

  mostraMessaggio("Invio della prenotazione in corso…");

  try {
    const dati = Object.fromEntries(new FormData(form));

    // Mantiene il formato della richiesta utilizzato dal modulo originale.
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(dati)
    });

    const risposta = await response.json();

    if (risposta.ok) {
      const dettagli = document.getElementById("dettagli");

      dettagli.textContent =
        `${risposta.data} · ${risposta.corso} (${risposta.orario})`;

      document.getElementById("modulo").hidden = true;
      document.getElementById("successo").hidden = false;

      window.scrollTo({ top: 0, behavior: "smooth" });

    } else {
      mostraMessaggio(
        risposta.errore || "Prenotazione non riuscita. Riprova.",
        true
      );

      // Ritorna alla scelta del giorno per aggiornare la disponibilità.
      faseCorrente = 3;
      aggiornaInterfaccia();
      await caricaGiorni();
    }

  } catch (errore) {
    mostraMessaggio(
      "Connessione non riuscita. Controlla la connessione e riprova.",
      true
    );

  } finally {
    bottoneInvia.disabled = false;
    bottoneAvanti.disabled = false;
    bottoneIndietro.disabled = false;
  }
}

/* NUOVA PRENOTAZIONE */

function nuovaPrenotazione() {
  form.reset();

  document.getElementById("successo").hidden = true;
  document.getElementById("modulo").hidden = false;

  faseCorrente = 0;
  giornoInput.value = "";

  giorniBox.replaceChildren();

  document.querySelectorAll("[data-blocco]").forEach((blocco) => {
    blocco.hidden = true;
    disattivaBlocco(blocco, true);
  });

  document.querySelectorAll("[data-condizionale]").forEach((blocco) => {
    blocco.hidden = true;

    blocco.querySelectorAll("input, select, textarea").forEach((elemento) => {
      elemento.disabled = true;
      elemento.value = "";
    });
  });

  aggiornaInterfaccia();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* EVENTI */

form.elements.tipo.forEach((radio) => {
  radio.addEventListener("change", () => {
    aggiornaBlocchi();
    mostraMessaggio();
  });
});

campo("figlioNascita").addEventListener("change", () => {
  if (faseCorrente === 3) caricaGiorni();
});

campo("figlioEsperienza").addEventListener("change", aggiornaCondizionali);
campo("adultoEsperienza").addEventListener("change", aggiornaCondizionali);

bottoneAvanti.addEventListener("click", vaiAvanti);
bottoneIndietro.addEventListener("click", vaiIndietro);
form.addEventListener("submit", invia);

document.getElementById("chiudi").addEventListener("click", () => {
  dialogo.close();
});

document.getElementById("nuova").addEventListener("click", nuovaPrenotazione);

/* AVVIO */

aggiornaBlocchi();
aggiornaInterfaccia();
