const API_URL = "https://script.google.com/macros/s/AKfycbxXVHHGaC5iXk3ep0XHQHAp6E5sa7zuwuxfcccwC3svJVr5MDGQqFAtCrNhYqpGu0YKfA/exec";

const $ = (id) => document.getElementById(id);

const form = $("form");
const giorniBox = $("giorni");
const giornoInput = $("giorno");

const tipo = () => form.elements.tipo.value;

let passo = 0;
let richiestaDisponibilita = 0;

// --------------------------------------------------
// FUNZIONI GENERALI
// --------------------------------------------------

function el(tag, classe, testo) {
  const elemento = document.createElement(tag);

  if (classe) {
    elemento.className = classe;
  }

  if (testo !== undefined) {
    elemento.textContent = testo;
  }

  return elemento;
}

function messaggio(testo, errore = false) {
  $("messaggio").textContent = testo;
  $("messaggio").className = errore ? "errore" : "";
}

function nota(testo, errore = false) {
  giorniBox.replaceChildren(
    el("p", errore ? "nota errore" : "nota", testo)
  );
}

// Legge il valore del campo attivo.
// È importante perché nell'HTML possono esserci più campi
// con lo stesso name, ad esempio comune ed email.
function val(nome) {
  const campi = form.querySelectorAll(`[name="${nome}"]`);

  for (const campo of campi) {
    if (
      !campo.disabled &&
      !campo.closest("[hidden]") &&
      campo.type !== "hidden"
    ) {
      return String(campo.value || "").trim();
    }
  }

  return "";
}

// Restituisce il campo attivo con il nome specificato.
function campoAttivo(nome) {
  const campi = form.querySelectorAll(`[name="${nome}"]`);

  for (const campo of campi) {
    if (
      !campo.disabled &&
      !campo.closest("[hidden]")
    ) {
      return campo;
    }
  }

  return null;
}

// --------------------------------------------------
// SCELTA DEL PERCORSO: GENITORE O ADULTO
// --------------------------------------------------

function aggiornaTipo() {
  document.querySelectorAll("[data-blocco]").forEach((blocco) => {
    const attivo = blocco.dataset.blocco === tipo();

    blocco.hidden = !attivo;

    blocco.querySelectorAll("input, select, textarea").forEach((campo) => {
      campo.disabled = !attivo;
    });
  });

  // I contatti dell'adulto sono separati da quelli del genitore.
  const contattiAdulto = $("contattiAdulto");

  if (contattiAdulto) {
    const attivi = tipo() === "adulto";

    contattiAdulto.hidden = !attivi;

    contattiAdulto.querySelectorAll("input, select, textarea").forEach((campo) => {
      campo.disabled = !attivi;
    });
  }

  aggiornaGrado();
}

// --------------------------------------------------
// DOMANDA DINAMICA SULL'ESPERIENZA NEL KARATE
// --------------------------------------------------

function esperienzaCorrente() {
  if (tipo() === "genitore") {
    return val("figlioEsperienza");
  }

  if (tipo() === "adulto") {
    return val("adultoEsperienza");
  }

  return "";
}

function aggiornaGrado() {
  const contenitoreGrado = $("campoGrado");

  if (!contenitoreGrado) {
    return;
  }

  const inputGrado = contenitoreGrado.querySelector("input");
  const esperienza = esperienzaCorrente();

  const mostraGrado = esperienza === "Sì";

  // Mostra il campo solo se la risposta è Sì.
  contenitoreGrado.hidden = !mostraGrado;
  inputGrado.disabled = !mostraGrado;

  // Se la risposta è No, elimina un eventuale grado precedente.
  if (!mostraGrado) {
    inputGrado.value = "";
  }

  // Posiziona la domanda sul grado immediatamente dopo
  // la domanda sull'esperienza del percorso attivo.
  const bloccoAttivo = document.querySelector(
    `[data-blocco="${tipo()}"]`
  );

  if (!bloccoAttivo) {
    return;
  }

  const domandaEsperienza = bloccoAttivo.querySelector(
    'select[name="figlioEsperienza"], select[name="adultoEsperienza"]'
  );

  if (domandaEsperienza) {
    const etichetta = domandaEsperienza.closest("label");

    if (etichetta && contenitoreGrado.previousElementSibling !== etichetta) {
      etichetta.insertAdjacentElement("afterend", contenitoreGrado);
    }
  }
}

// --------------------------------------------------
// NAVIGAZIONE TRA LE PAGINE
// --------------------------------------------------

function mostraPasso() {
  $("dopo").hidden = !tipo();

  document.querySelectorAll("[data-passo]").forEach((sezione) => {
    sezione.hidden = Number(sezione.dataset.passo) !== passo;
  });

  $("indietro").hidden = passo === 0;
  $("avanti").hidden = passo === 3;
  $("invia").hidden = passo !== 3;

  messaggio("");

  if (passo === 2) {
    caricaGiorni();
  }

  if (passo === 3) {
    riepilogo();
  }
}

function passoValido() {
  // Pagina 1: scelta del percorso.
  if (passo === 0) {
    if (tipo()) {
      return true;
    }

    messaggio(
      "Scegli se prenoti per tuo figlio/a oppure per te.",
      true
    );

    return false;
  }

  // Pagina della scelta del giorno.
  if (passo === 2) {
    if (giornoInput.value) {
      return true;
    }

    messaggio("Scegli un giorno per la prova.", true);

    return false;
  }

  // Controlla i campi obbligatori della pagina corrente.
  const sezione = document.querySelector(
    `[data-passo="${passo}"]`
  );

  if (!sezione) {
    return true;
  }

  const campi = sezione.querySelectorAll(
    "input, select, textarea"
  );

  for (const campo of campi) {
    if (
      campo.disabled ||
      campo.type === "hidden" ||
      campo.closest("[hidden]")
    ) {
      continue;
    }

    if (!campo.checkValidity()) {
      campo.reportValidity();
      return false;
    }
  }

  return true;
}

function vai(delta) {
  if (delta > 0 && !passoValido()) {
    return;
  }

  passo = Math.max(0, Math.min(3, passo + delta));

  mostraPasso();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// --------------------------------------------------
// CARICAMENTO DELLA DISPONIBILITÀ
// --------------------------------------------------

async function caricaGiorni() {
  const numeroRichiesta = ++richiestaDisponibilita;

  giornoInput.value = "";

  if (!tipo()) {
    giorniBox.replaceChildren();
    return;
  }

  const nascita = tipo() === "genitore"
    ? val("figlioNascita")
    : "";

  // Per il percorso genitore serve la data di nascita del figlio.
  if (tipo() === "genitore" && !nascita) {
    return nota(
      "Inserisci la data di nascita del figlio/a per vedere i giorni disponibili."
    );
  }

  nota("Caricamento…");

  try {
    const url =
      `${API_URL}?azione=disponibilita` +
      `&tipo=${encodeURIComponent(tipo())}` +
      `&nascita=${encodeURIComponent(nascita)}`;

    const rispostaHTTP = await fetch(url);
    const risposta = await rispostaHTTP.json();

    // Ignora le risposte di richieste precedenti.
    if (numeroRichiesta !== richiestaDisponibilita) {
      return;
    }

    if (!risposta.ok) {
      throw new Error(
        risposta.errore || "Disponibilità non disponibile."
      );
    }

    disegnaGiorni(risposta.giorni || []);

  } catch (errore) {
    if (numeroRichiesta !== richiestaDisponibilita) {
      return;
    }

    nota(
      errore.message || "Impossibile caricare i giorni. Riprova.",
      true
    );
  }
}

// --------------------------------------------------
// VISUALIZZAZIONE DEI GIORNI
// --------------------------------------------------

function disegnaGiorni(giorni) {
  if (!giorni.length) {
    return nota("Al momento non ci sono giorni disponibili.");
  }

  giorniBox.replaceChildren(
    ...giorni.map((giorno) => {
      const livello =
        giorno.postiRimasti >= 3
          ? "verde"
          : giorno.postiRimasti === 2
            ? "giallo"
            : giorno.postiRimasti === 1
              ? "rosso"
              : "pieno";

      const parti = (giorno.etichetta || "").split(" ");

      const settimana = parti[0] || "";
      const data = parti.slice(1).join(" ") || "";

      const bottone = el("button", `giorno ${livello}`);

      bottone.type = "button";
      bottone.dataset.etichetta = giorno.etichetta || giorno.data;

      bottone.setAttribute(
        "aria-label",
        `${giorno.etichetta || giorno.data}, ${
          livello === "pieno"
            ? "pieno"
            : `${giorno.postiRimasti} posti`
        }`
      );

      bottone.append(
        el("span", "", settimana),
        el("strong", "", data.slice(0, 5))
      );

      if (livello === "pieno") {
        bottone.setAttribute("aria-disabled", "true");
      }

      bottone.addEventListener("click", () => {
        if (livello === "pieno") {
          $("dialogo").showModal();
          return;
        }

        giorniBox.querySelectorAll(".giorno").forEach((elemento) => {
          elemento.classList.remove("scelto");
        });

        bottone.classList.add("scelto");

        giornoInput.value = giorno.data;

        messaggio("");
      });

      return bottone;
    })
  );
}

// --------------------------------------------------
// RIEPILOGO DELLA PRENOTAZIONE
// --------------------------------------------------

function riepilogo() {
  const gruppi = [];

  if (tipo() === "genitore") {
    // Dati del genitore.
    gruppi.push([
      "Dati del genitore",
      [
        ["Nome", val("genitoreNome")],
        ["Cognome", val("genitoreCognome")],
        ["Comune di residenza", val("comune")],
        ["Telefono", val("genitoreTelefono")],
        ["Email", val("email")]
      ]
    ]);

    // Dati del figlio/a.
    const datiFiglio = [
      ["Nome", val("figlioNome")],
      ["Data di nascita", val("figlioNascita")],
      ["Ha già praticato karate", val("figlioEsperienza")]
    ];

    // Il grado viene inserito nel riepilogo solo se la risposta è Sì.
    if (val("figlioEsperienza") === "Sì") {
      datiFiglio.push(["Grado", val("grado")]);
    }

    datiFiglio.push(
      ["Accompagnatore", val("accompagnatore")],
      ["Note", val("figlioNote")]
    );

    gruppi.push([
      "Dati del figlio/a",
      datiFiglio
    ]);

  } else if (tipo() === "adulto") {
    // Dati dell'adulto.
    const datiAdulto = [
      ["Nome", val("adultoNome")],
      ["Cognome", val("adultoCognome")],
      ["Data di nascita", val("adultoNascita")],
      ["Comune di residenza", val("comune")],
      ["Telefono", val("adultoTelefono")],
      ["Email", val("email")],
      ["Ha già praticato karate", val("adultoEsperienza")]
    ];

    // Il grado viene inserito nel riepilogo solo se la risposta è Sì.
    if (val("adultoEsperienza") === "Sì") {
      datiAdulto.push(["Grado", val("grado")]);
    }

    gruppi.push([
      "Dati personali",
      datiAdulto
    ]);
  }

  // Giorno selezionato.
  const giornoScelto = giorniBox.querySelector(".giorno.scelto");

  gruppi.push([
    "Prova",
    [
      [
        "Giorno",
        giornoScelto?.dataset.etichetta || giornoInput.value
      ]
    ]
  ]);

  const box = $("riepilogo");

  box.replaceChildren();

  gruppi.forEach(([titolo, righe]) => {
    box.append(el("h3", "", titolo));

    righe.forEach(([nome, valore]) => {
      const riga = el("dl");

      riga.append(
        el("dt", "", nome),
        el("dd", "", valore || "—")
      );

      box.append(riga);
    });
  });
}

// --------------------------------------------------
// INVIO DELLA PRENOTAZIONE
// --------------------------------------------------

async function invia(evento) {
  evento.preventDefault();

  if (passo !== 3) {
    return;
  }

  if (!giornoInput.value) {
    messaggio(
      "Torna alla scelta del giorno e seleziona una disponibilità.",
      true
    );

    return;
  }

  // Controlla che il riepilogo corrisponda ancora ai dati correnti.
  riepilogo();

  $("invia").disabled = true;

  messaggio("Invio in corso…");

  try {
    // Mantiene il formato atteso dal backend Google Apps Script.
    const dati = Object.fromEntries(new FormData(form));

    const rispostaHTTP = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(dati)
    });

    const risposta = await rispostaHTTP.json();

    if (risposta.ok) {
      // Nasconde il modulo e il testo introduttivo.
      form.hidden = true;
      $("intro").hidden = true;

      // Mostra la conferma.
      $("successo").hidden = false;

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    } else {
      messaggio(
        risposta.errore || "Prenotazione non riuscita.",
        true
      );

      // Aggiorna le disponibilità nel caso in cui i posti siano esauriti.
      caricaGiorni();
    }

  } catch (errore) {
    messaggio(
      "Connessione non riuscita. Riprova tra poco.",
      true
    );

  } finally {
    $("invia").disabled = false;
  }
}

// --------------------------------------------------
// NUOVA PRENOTAZIONE
// --------------------------------------------------

function nuovaPrenotazione() {
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

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// --------------------------------------------------
// EVENTI
// --------------------------------------------------

// Cambio tra prenotazione per un figlio e prenotazione per sé.
form.elements.tipo.forEach((radio) => {
  radio.addEventListener("change", () => {
    // Invalida eventuali richieste di disponibilità precedenti.
    richiestaDisponibilita++;

    // Pulisce i dati del percorso che non è più selezionato.
    document.querySelectorAll("[data-blocco]").forEach((blocco) => {
      if (blocco.dataset.blocco !== tipo()) {
        blocco.querySelectorAll("input, select, textarea").forEach((campo) => {
          campo.value = "";
        });
      }
    });

    // Pulisce anche i contatti del percorso non attivo.
    const contattiAdulto = $("contattiAdulto");

    if (tipo() !== "adulto" && contattiAdulto) {
      contattiAdulto.querySelectorAll("input").forEach((campo) => {
        campo.value = "";
      });
    }

    giornoInput.value = "";
    giorniBox.replaceChildren();

    aggiornaTipo();
    mostraPasso();
  });
});

// Quando cambia la data di nascita del figlio, aggiorna le disponibilità.
form.elements.figlioNascita.addEventListener("change", () => {
  giornoInput.value = "";
  caricaGiorni();
});

// Quando cambia la risposta sull'esperienza, aggiorna il grado.
form.elements.figlioEsperienza.addEventListener(
  "change",
  aggiornaGrado
);

form.elements.adultoEsperienza.addEventListener(
  "change",
  aggiornaGrado
);

// Navigazione.
$("avanti").addEventListener("click", () => vai(1));
$("indietro").addEventListener("click", () => vai(-1));

// Finestra del turno pieno.
$("chiudi").addEventListener("click", () => {
  $("dialogo").close();
});

// Schermata finale.
$("nuova").addEventListener("click", nuovaPrenotazione);

// Invio.
form.addEventListener("submit", invia);

// --------------------------------------------------
// INIZIALIZZAZIONE
// --------------------------------------------------

aggiornaTipo();
mostraPasso();
