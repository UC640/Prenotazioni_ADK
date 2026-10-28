const API_URL = "https://script.google.com/macros/s/AKfycbxXVHHGaC5iXk3ep0XHQHAp6E5sa7zuwuxfcccwC3svJVr5MDGQqFAtCrNhYqpGu0YKfA/exec";

const $ = (id) => document.getElementById(id);

const form = $("form");
const giorniBox = $("giorni");
const giornoInput = $("giorno");

let passo = 0;
let richiestaDisponibilita = 0;


// ==================================================
// FUNZIONI GENERALI
// ==================================================

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


function tipo() {
  const selezionato = form.querySelector(
    'input[name="tipo"]:checked'
  );

  return selezionato ? selezionato.value : "";
}


/*
 * Legge il valore del campo attivo.
 *
 * Non controlla se la pagina contenente il campo è nascosta:
 * il riepilogo deve poter leggere i dati anche quando si trova
 * su una pagina diversa.
 *
 * I campi del percorso non selezionato sono disabilitati.
 */
function val(nome) {
  const campi = form.querySelectorAll(`[name="${nome}"]`);

  for (const campo of campi) {
    if (!campo.disabled && campo.type !== "hidden") {
      return String(campo.value || "").trim();
    }
  }

  return "";
}


// ==================================================
// GESTIONE DEI PERCORSI
// ==================================================

function aggiornaTipo() {
  const percorso = tipo();

  /*
   * Mostra esclusivamente i blocchi relativi al percorso
   * selezionato e disabilita i campi dell'altro percorso.
   */
  document.querySelectorAll("[data-blocco]").forEach((blocco) => {
    const attivo = blocco.dataset.blocco === percorso;

    blocco.hidden = !attivo;

    blocco.querySelectorAll("input, select, textarea").forEach((campo) => {
      campo.disabled = !attivo;
    });
  });

  aggiornaGrado();
}


// ==================================================
// ESPERIENZA NEL KARATE E CAMPO GRADO
// ==================================================

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
  const percorso = tipo();

  let contenitore;
  let nomeCampoEsperienza;

  if (percorso === "genitore") {
    contenitore = $("campoGradoBambino");
    nomeCampoEsperienza = "figlioEsperienza";
  } else if (percorso === "adulto") {
    contenitore = $("campoGradoAdulto");
    nomeCampoEsperienza = "adultoEsperienza";
  } else {
    return;
  }

  if (!contenitore) {
    return;
  }

  const inputGrado = contenitore.querySelector('input[name="grado"]');
  const campoEsperienza = form.querySelector(
    `[name="${nomeCampoEsperienza}"]`
  );

  const mostra = campoEsperienza?.value === "Sì";

  /*
   * Il campo viene mostrato solo quando la risposta è Sì.
   */
  contenitore.hidden = !mostra;

  inputGrado.disabled = !mostra;

  /*
   * Se la risposta è No, cancella il grado precedentemente inserito.
   */
  if (!mostra) {
    inputGrado.value = "";
  }
}


// ==================================================
// NAVIGAZIONE TRA LE PAGINE
// ==================================================

function mostraPasso() {
  const percorso = tipo();

  $("dopo").hidden = !percorso;

  document.querySelectorAll("[data-passo]").forEach((sezione) => {
    sezione.hidden = Number(sezione.dataset.passo) !== passo;
  });

  /*
   * La freccia Avanti non appare nella pagina del riepilogo.
   * In quella pagina compare il pulsante di conferma.
   */
  $("indietro").hidden = passo === 0;
  $("avanti").hidden = passo === 4;
  $("invia").hidden = passo !== 4;

  messaggio("");

  if (passo === 3) {
    caricaGiorni();
  }

  if (passo === 4) {
    riepilogo();
  }
}


function passoValido() {
  /*
   * PAGINA 0
   * Scelta tra genitore e adulto.
   */
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

  /*
   * Controlla i campi visibili della pagina corrente.
   * I campi disabilitati e quelli nascosti non vengono validati.
   */
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

  /*
   * PAGINA 3
   * La scelta del giorno viene controllata separatamente.
   */
  if (passo === 3 && !giornoInput.value) {
    messaggio("Scegli un giorno per la prova.", true);
    return false;
  }

  return true;
}


function vai(delta) {
  if (delta > 0 && !passoValido()) {
    return;
  }

  const nuovoPasso = passo + delta;

  if (nuovoPasso < 0 || nuovoPasso > 4) {
    return;
  }

  passo = nuovoPasso;

  mostraPasso();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ==================================================
// DISPONIBILITÀ DEI GIORNI
// ==================================================

async function caricaGiorni() {
  const numeroRichiesta = ++richiestaDisponibilita;

  giornoInput.value = "";

  if (!tipo()) {
    giorniBox.replaceChildren();
    return;
  }

  /*
   * Per le prenotazioni dei bambini, la disponibilità
   * dipende dalla data di nascita del bambino/a.
   */
  const nascita = tipo() === "genitore"
    ? val("figlioNascita")
    : "";

  if (tipo() === "genitore" && !nascita) {
    return nota(
      "Inserisci la data di nascita del bambino/a per vedere i giorni disponibili."
    );
  }

  nota("Caricamento dei giorni disponibili…");

  try {
    const url =
      `${API_URL}?azione=disponibilita` +
      `&tipo=${encodeURIComponent(tipo())}` +
      `&nascita=${encodeURIComponent(nascita)}`;

    const rispostaHTTP = await fetch(url);
    const risposta = await rispostaHTTP.json();

    /*
     * Ignora una risposta se nel frattempo è partita
     * una nuova richiesta di disponibilità.
     */
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


// ==================================================
// DISEGNO DEI GIORNI DISPONIBILI
// ==================================================

function disegnaGiorni(giorni) {
  if (!giorni.length) {
    return nota("Al momento non ci sono giorni disponibili.");
  }

  giorniBox.replaceChildren(
    ...giorni.map((giorno) => {
      let livello;

      if (giorno.postiRimasti >= 3) {
        livello = "verde";
      } else if (giorno.postiRimasti === 2) {
        livello = "giallo";
      } else if (giorno.postiRimasti === 1) {
        livello = "rosso";
      } else {
        livello = "pieno";
      }

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
            ? "turno pieno"
            : `${giorno.postiRimasti} posti disponibili`
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


// ==================================================
// RIEPILOGO
// ==================================================

function riepilogo() {
  const gruppi = [];

  if (tipo() === "genitore") {
    /*
     * DATI DEL GENITORE
     * L'ordine del riepilogo rispecchia quello del modulo.
     */
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

    /*
     * DATI DEL BAMBINO/A
     */
    gruppi.push([
      "Dati del bambino/a",
      [
        ["Nome", val("figlioNome")],
        ["Data di nascita", val("figlioNascita")]
      ]
    ]);

    /*
     * INFORMAZIONI SUL BAMBINO/A
     */
    const datiEsperienza = [
      ["Ha già fatto karate", val("figlioEsperienza")]
    ];

    /*
     * Il grado compare soltanto se l'esperienza è Sì.
     */
    if (val("figlioEsperienza") === "Sì") {
      datiEsperienza.push(["Grado", val("grado")]);
    }

    datiEsperienza.push(
      ["Accompagnatore", val("accompagnatore")],
      ["Note", val("figlioNote")]
    );

    gruppi.push([
      "Informazioni sul bambino/a",
      datiEsperienza
    ]);

  } else if (tipo() === "adulto") {
    /*
     * DATI PERSONALI DELL'ADULTO
     */
    gruppi.push([
      "Dati personali",
      [
        ["Nome", val("adultoNome")],
        ["Cognome", val("adultoCognome")],
        ["Data di nascita", val("adultoNascita")],
        ["Comune di residenza", val("comune")],
        ["Telefono", val("adultoTelefono")],
        ["Email", val("email")]
      ]
    ]);

    /*
     * ESPERIENZA DELL'ADULTO
     */
    const datiEsperienza = [
      ["Ha già fatto karate", val("adultoEsperienza")]
    ];

    if (val("adultoEsperienza") === "Sì") {
      datiEsperienza.push(["Grado", val("grado")]);
    }

    gruppi.push([
      "Esperienza nel karate",
      datiEsperienza
    ]);
  }

  /*
   * GIORNO DELLA PROVA
   */
  const bottoneScelto = giorniBox.querySelector(".giorno.scelto");

  const etichettaGiorno =
    bottoneScelto?.dataset.etichetta || giornoInput.value;

  gruppi.push([
    "Giorno della prova",
    [
      ["Giorno selezionato", etichettaGiorno]
    ]
  ]);

  /*
   * COSTRUZIONE DEL RIEPILOGO HTML
   */
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


// ==================================================
// INVIO DELLA PRENOTAZIONE
// ==================================================

async function invia(evento) {
  evento.preventDefault();

  if (passo !== 4) {
    return;
  }

  if (!giornoInput.value) {
    messaggio(
      "Torna alla scelta del giorno e seleziona una disponibilità.",
      true
    );

    return;
  }

  $("invia").disabled = true;

  messaggio("Invio della prenotazione in corso…");

  try {
    /*
     * FormData include i campi attivi.
     * I campi disabilitati del percorso non selezionato
     * non vengono inviati.
     */
    const dati = Object.fromEntries(
      new FormData(form)
    );

    /*
     * Si mantiene text/plain per evitare la richiesta
     * CORS preflight non gestita da Google Apps Script.
     */
    const rispostaHTTP = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },

      body: JSON.stringify(dati)
    });

    const risposta = await rispostaHTTP.json();

    if (risposta.ok) {
      form.hidden = true;
      $("intro").hidden = true;

      $("successo").hidden = false;

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    } else {
      messaggio(
        risposta.errore || "Prenotazione non riuscita. Riprova.",
        true
      );

      /*
       * Aggiorna i posti disponibili se nel frattempo
       * il turno è diventato pieno.
       */
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


// ==================================================
// NUOVA PRENOTAZIONE
// ==================================================

function nuovaPrenotazione() {
  /*
   * Invalida eventuali richieste precedenti.
   */
  richiestaDisponibilita++;

  form.reset();

  form.hidden = false;
  $("intro").hidden = false;
  $("successo").hidden = true;

  passo = 0;

  giornoInput.value = "";

  giorniBox.replaceChildren();
  $("riepilogo").replaceChildren();

  messaggio("");

  /*
   * Ripristina la situazione iniziale dei campi
   * e nasconde i campi del grado.
   */
  aggiornaTipo();
  mostraPasso();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ==================================================
// EVENTI
// ==================================================

/*
 * Scelta tra genitore e adulto.
 */
form.querySelectorAll('input[name="tipo"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    richiestaDisponibilita++;

    /*
     * Pulisce i campi del percorso non selezionato.
     * I nomi dei campi del backend restano invariati.
     */
    document.querySelectorAll("[data-blocco]").forEach((blocco) => {
      if (blocco.dataset.blocco !== tipo()) {
        blocco.querySelectorAll("input, select, textarea").forEach((campo) => {
          campo.value = "";
        });
      }
    });

    giornoInput.value = "";
    giorniBox.replaceChildren();

    aggiornaTipo();
    mostraPasso();
  });
});


/*
 * Aggiorna il campo del grado quando cambia la risposta
 * relativa all'esperienza del bambino/a.
 */
form.elements.figlioEsperienza.addEventListener(
  "change",
  aggiornaGrado
);


/*
 * Aggiorna il campo del grado quando cambia la risposta
 * relativa all'esperienza dell'adulto.
 */
form.elements.adultoEsperienza.addEventListener(
  "change",
  aggiornaGrado
);


/*
 * Navigazione.
 */
$("avanti").addEventListener("click", () => vai(1));

$("indietro").addEventListener("click", () => vai(-1));


/*
 * Chiusura dell'avviso per un turno pieno.
 */
$("chiudi").addEventListener("click", () => {
  $("dialogo").close();
});


/*
 * Pulsante per iniziare una nuova prenotazione.
 */
$("nuova").addEventListener("click", nuovaPrenotazione);


/*
 * Invio del modulo.
 */
form.addEventListener("submit", invia);


// ==================================================
// INIZIALIZZAZIONE
// ==================================================

aggiornaTipo();
mostraPasso();
