const API_URL = "https://script.google.com/macros/s/AKfycbxXVHHGaC5iXk3ep0XHQHAp6E5sa7zuwuxfcccwC3svJVr5MDGQqFAtCrNhYqpGu0YKfA/exec";

const form = document.getElementById("form");
const giorniBox = document.getElementById("giorni");
const giornoInput = document.getElementById("giorno");
const messaggio = document.getElementById("messaggio");
const bottone = document.getElementById("invia");
const dialogo = document.getElementById("dialogo");

const tipo = () => form.elements.tipo.value;

let passaggioCorrente = 0;

const titoliPassaggi = [
  "Chi prenota?",
  "I tuoi dati",
  "Contatti e dettagli",
  "Scegli il giorno",
  "Riepilogo della prenotazione"
];

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

    blocco.querySelectorAll("input, select, textarea").forEach((c) => {
      c.disabled = !attivo;
    });
  });

  aggiornaGrado();
  caricaGiorni();
}

function aggiornaGrado() {
  const campoGrado = document.getElementById("campoGrado");
  const grado = form.elements.grado;

  let esperienza = "";

  if (tipo() === "genitore") {
    esperienza = form.elements.figlioEsperienza.value;
  } else if (tipo() === "adulto") {
    esperienza = form.elements.adultoEsperienza.value;
  }

  const visibile = esperienza === "Sì";

  campoGrado.hidden = !visibile;

  // Mantiene il campo originale "grado" anche quando non è visibile.
  // Se la persona risponde "No", il valore viene lasciato vuoto.
  if (!visibile) {
    grado.value = "";
  }
}

function aggiornaPassaggio() {
  const selezioneTipo = document.getElementById("selezioneTipo");
  const dopo = document.getElementById("dopo");

  selezioneTipo.hidden = passaggioCorrente !== 0;
  dopo.hidden = !tipo();

  document.querySelectorAll("[data-passaggio]").forEach((elemento) => {
    const numero = Number(elemento.dataset.passaggio);
    elemento.hidden = numero !== passaggioCorrente;
  });

  document.getElementById("indietro").hidden = passaggioCorrente === 0;

  document.getElementById("avanti").hidden = passaggioCorrente === 4;
  bottone.hidden = passaggioCorrente !== 4;

  document.getElementById("titoloPassaggio").textContent =
    titoliPassaggi[passaggioCorrente];

  document.getElementById("numeroPassaggio").textContent =
    `${passaggioCorrente + 1} / ${titoliPassaggi.length}`;

  document.getElementById("progresso").style.width =
    `${((passaggioCorrente + 1) / titoliPassaggi.length) * 100}%`;

  document.querySelectorAll("[data-etichetta]").forEach((etichetta) => {
    const numero = Number(etichetta.dataset.etichetta);

    etichetta.classList.toggle("attivo", numero === passaggioCorrente);
  });

  mostraMessaggio("");

  if (passaggioCorrente === 3) {
    caricaGiorni();
  }

  if (passaggioCorrente === 4) {
    aggiornaRiepilogo();
  }
}

function controllaPassaggio() {
  if (passaggioCorrente === 0) {
    const selezionato = form.querySelector('input[name="tipo"]:checked');

    if (!selezionato) {
      form.querySelector('input[name="tipo"]').reportValidity();
      return false;
    }

    return true;
  }

  if (passaggioCorrente === 3) {
    if (!giornoInput.value) {
      mostraMessaggio("Scegli un giorno per la prova.", true);
      return false;
    }

    return true;
  }

  const passaggio = document.querySelector(
    `[data-passaggio="${passaggioCorrente}"]`
  );

  if (!passaggio) {
    return true;
  }

  const campi = passaggio.querySelectorAll(
    "input, select, textarea"
  );

  for (const campo of campi) {
    if (
      campo.disabled ||
      campo.closest("[hidden]") ||
      campo.type === "hidden"
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

function vaiAvanti() {
  if (!controllaPassaggio()) {
    return;
  }

  if (passaggioCorrente < 4) {
    passaggioCorrente++;
    aggiornaPassaggio();
    window.scrollTo(0, 0);
  }
}

function vaiIndietro() {
  if (passaggioCorrente > 0) {
    passaggioCorrente--;
    aggiornaPassaggio();
    window.scrollTo(0, 0);
  }
}

async function caricaGiorni() {
  giornoInput.value = "";

  if (!tipo()) {
    return;
  }

  const nascita =
    tipo() === "genitore"
      ? form.elements.figlioNascita.value
      : "";

  if (tipo() === "genitore" && !nascita) {
    return nota(
      "Inserisci la data di nascita del figlio/a per vedere i giorni disponibili."
    );
  }

  nota("Caricamento dei giorni…");

  try {
    const url =
      `${API_URL}?azione=disponibilita&tipo=${tipo()}` +
      `&nascita=${encodeURIComponent(nascita)}`;

    const risposta = await (await fetch(url)).json();

    if (!risposta.ok) {
      throw new Error(risposta.errore);
    }

    disegnaGiorni(risposta.giorni);
  } catch (err) {
    nota(
      err.message || "Impossibile caricare i giorni. Riprova.",
      "errore"
    );
  }
}

function disegnaGiorni(giorni) {
  if (!giorni.length) {
    return nota("Al momento non ci sono giorni disponibili.");
  }

  const bottoni = giorni.map((g) => {
    const livello =
      g.postiRimasti >= 3
        ? "verde"
        : g.postiRimasti === 2
          ? "giallo"
          : g.postiRimasti === 1
            ? "rosso"
            : "pieno";

    const testoPosti = {
      verde: `${g.postiRimasti} posti`,
      giallo: "2 posti",
      rosso: "Ultimo posto",
      pieno: "Pieno"
    }[livello];

    const b = document.createElement("button");

    b.type = "button";
    b.className = `giorno ${livello}`;
    b.dataset.data = g.data;

    if (livello === "pieno") {
      b.setAttribute("aria-disabled", "true");
    }

    const titolo = document.createElement("strong");
    titolo.textContent = g.etichetta;

    const dettaglio = document.createElement("span");
    dettaglio.textContent = `${g.corso} · ${g.orario}`;

    const posti = document.createElement("small");
    posti.textContent = testoPosti;

    b.append(titolo, dettaglio, posti);

    b.addEventListener("click", () => {
      if (livello === "pieno") {
        return dialogo.showModal();
      }

      giorniBox.querySelectorAll(".giorno").forEach((x) => {
        x.classList.remove("scelto");
      });

      b.classList.add("scelto");
      giornoInput.value = g.data;

      mostraMessaggio("");
    });

    return b;
  });

  giorniBox.replaceChildren(...bottoni);
}

function valore(nome) {
  const elemento = form.elements[nome];

  if (!elemento) {
    return "";
  }

  return String(elemento.value || "").trim();
}

function aggiungiGruppoRiepilogo(titolo, righe, contenitore) {
  const gruppo = document.createElement("section");
  gruppo.className = "riepilogo-gruppo";

  const intestazione = document.createElement("h3");
  intestazione.textContent = titolo;

  gruppo.appendChild(intestazione);

  righe.forEach(([etichetta, testo]) => {
    const riga = document.createElement("dl");
    riga.className = "riepilogo-riga";

    const nome = document.createElement("dt");
    nome.textContent = etichetta;

    const valoreRiga = document.createElement("dd");
    valoreRiga.textContent = testo || "—";

    riga.append(nome, valoreRiga);
    gruppo.appendChild(riga);
  });

  contenitore.appendChild(gruppo);
}

function aggiornaRiepilogo() {
  const riepilogo = document.getElementById("riepilogo");

  riepilogo.replaceChildren();

  if (tipo() === "genitore") {
    aggiungiGruppoRiepilogo(
      "Genitore",
      [
        ["Nome", valore("genitoreNome")],
        ["Cognome", valore("genitoreCognome")],
        ["Telefono", valore("genitoreTelefono")]
      ],
      riepilogo
    );

    aggiungiGruppoRiepilogo(
      "Figlio/a",
      [
        ["Nome", valore("figlioNome")],
        ["Data di nascita", valore("figlioNascita")],
        ["Esperienza nel karate", valore("figlioEsperienza")],
        ["Accompagnatore", valore("accompagnatore")],
        ["Note", valore("figlioNote")]
      ],
      riepilogo
    );
  } else {
    aggiungiGruppoRiepilogo(
      "Dati personali",
      [
        ["Nome", valore("adultoNome")],
        ["Cognome", valore("adultoCognome")],
        ["Telefono", valore("adultoTelefono")],
        ["Data di nascita", valore("adultoNascita")],
        ["Esperienza nel karate", valore("adultoEsperienza")]
      ],
      riepilogo
    );
  }

  aggiungiGruppoRiepilogo(
    "Contatti",
    [
      ["Email", valore("email")],
      ["Comune", valore("comune")],
      ["Grado", valore("grado")]
    ],
    riepilogo
  );

  const giornoScelto = giorniBox.querySelector(".giorno.scelto");

  aggiungiGruppoRiepilogo(
    "Prova",
    [
      [
        "Giorno e turno",
        giornoScelto
          ? giornoScelto.textContent.replace(/\s+/g, " ").trim()
          : giornoInput.value
      ]
    ],
    riepilogo
  );
}

async function invia(evento) {
  evento.preventDefault();

  if (passaggioCorrente !== 4) {
    return;
  }

  if (!giornoInput.value) {
    mostraMessaggio(
      "Torna alla scelta del giorno e seleziona una disponibilità.",
      true
    );
    return;
  }

  bottone.disabled = true;
  mostraMessaggio("Invio in corso…");

  try {
    const dati = Object.fromEntries(new FormData(form));

    // text/plain evita la richiesta "preflight" CORS, che Apps Script non gestisce.
    const risposta = await (await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(dati)
    })).json();

    if (risposta.ok) {
      document.getElementById("dettagli").textContent =
        `${risposta.data} · ${risposta.corso} (${risposta.orario})`;

      form.hidden = true;
      document.getElementById("successo").hidden = false;

      window.scrollTo(0, 0);
    } else {
      mostraMessaggio(
        risposta.errore || "Prenotazione non riuscita.",
        true
      );

      caricaGiorni();
    }
  } catch (err) {
    mostraMessaggio(
      "Connessione non riuscita. Riprova tra poco.",
      true
    );
  } finally {
    bottone.disabled = false;
  }
}

function nuovaPrenotazione() {
  form.reset();

  form.hidden = false;
  document.getElementById("successo").hidden = true;

  passaggioCorrente = 0;

  giornoInput.value = "";
  giorniBox.replaceChildren();

  aggiornaBlocchi();
  aggiornaPassaggio();

  mostraMessaggio("");

  window.scrollTo(0, 0);
}

form.elements.tipo.forEach((r) => {
  r.addEventListener("change", aggiornaBlocchi);
});

form.elements.figlioNascita.addEventListener("change", caricaGiorni);

form.elements.figlioEsperienza.addEventListener("change", aggiornaGrado);
form.elements.adultoEsperienza.addEventListener("change", aggiornaGrado);

document.getElementById("avanti").addEventListener("click", vaiAvanti);
document.getElementById("indietro").addEventListener("click", vaiIndietro);

form.addEventListener("submit", invia);

document.getElementById("chiudi").addEventListener("click", () => {
  dialogo.close();
});

document.getElementById("nuovaPrenotazione").addEventListener(
  "click",
  nuovaPrenotazione
);

aggiornaBlocchi();
aggiornaPassaggio();
