import { buildFrenchSchedule, parsePercentFromOptionText } from "./frances.js";
import { buildGermanSchedule } from "./german.js";
import { getChargesForCreditoTipo } from "./amortCharges.js";

const formCredit = document.getElementById("form-credit");
const creditError = document.getElementById("credit-error");
const creditResults = document.getElementById("credit-results");
const tableBody = document.getElementById("res-table-body");

const LABEL_CUOTA_PI_FR = "Cuota fija capital + interés";
const LABEL_CUOTA_PI_DE = "Capital amortización (const. por período)";

const DISCLAIMER_FR =
  "La TEA se calcula capitalizando mensualmente la TNA. El seguro sobre saldo usa un coeficiente por frecuencia (calibración referencial, no es un producto legal vinculante). Los porcentajes de aporte en reservas y contribución/SOLCA dependen del tipo de crédito (p. ej. productivo corporativo con ratios distintos al consumo).";
const DISCLAIMER_DE =
  "Sistema VARIABLE (alemán): capital constante cada período sobre el plazo efectivo de pagos; interés sobre saldo inicial; seguro modelo como fracción del interés (~10% en referencias del simulador). TEA igual que en francés. Aportes y contribuciones aplican sobre el monto según tipo de crédito.";

function formatMoney(n) {
  return Number(n).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseNumberInput(raw) {
  if (raw == null || String(raw).trim() === "") return NaN;
  const t = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  const v = parseFloat(t, 10);
  return Number.isFinite(v) ? v : NaN;
}

function getTnaFromForm() {
  const sel = document.getElementById("tipo-credito");
  const opt = sel.options[sel.selectedIndex];
  const fromData = opt.getAttribute("data-tna");
  if (fromData) return parseFloat(fromData, 10);
  const fromText = parsePercentFromOptionText(opt.textContent || "");
  if (fromText != null) return fromText;
  return 12.77;
}

function segmentLabel(value) {
  const map = {
    consumo: "Consumo Ordinario/Prioritario",
    microcredito: "Microcrédito",
    inmobiliario: "Inmobiliario",
  };
  return map[value] || value;
}

/** @param {'mensual' | 'bimestral' | 'trimestral'} freq */
function frequencyLabel(freq) {
  const map = { mensual: "MENSUAL", bimestral: "BIMENSUAL", trimestral: "TRIMESTRAL" };
  return map[freq] || freq;
}

function showError(msg) {
  creditError.textContent = msg;
  creditError.classList.remove("hidden");
}

function clearError() {
  creditError.textContent = "";
  creditError.classList.add("hidden");
}

formCredit.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError();

  const tipoCuota = formCredit.querySelector('input[name="tipo-cuota"]:checked')?.value || "frances";
  const tipoCreditoValue = document.getElementById("tipo-credito").value;

  const freq = /** @type {'mensual'|'bimestral'|'trimestral'} */ (document.getElementById("frecuencia").value);

  const principal = parseNumberInput(document.getElementById("monto").value);
  const months = Math.trunc(parseNumberInput(document.getElementById("plazo").value));

  if (!(principal > 0)) {
    showError("Ingrese un monto válido mayor que cero.");
    return;
  }
  if (!(months > 0 && months <= 600)) {
    showError("Ingrese un plazo en meses válido (1–600).");
    return;
  }

  const annualNominal = getTnaFromForm();
  const { reserveRatio, solcaRatio } = getChargesForCreditoTipo(tipoCreditoValue);

  let result;
  try {
    if (tipoCuota === "aleman") {
      result = buildGermanSchedule({
        principal,
        months,
        annualNominalPercent: annualNominal,
        frequency: freq,
        reserveRatio,
        solcaRatio,
      });
    } else {
      result = buildFrenchSchedule({
        principal,
        months,
        annualNominalPercent: annualNominal,
        frequency: freq,
        reserveRatio,
        solcaRatio,
      });
    }
  } catch (err) {
    showError(err.message || "No se pudo calcular.");
    return;
  }

  const now = new Date();
  const fechaStr = now.toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const esAleman = result.metodo === "aleman";

  document.getElementById("res-fecha").textContent = fechaStr;
  document.getElementById("res-segmento").textContent = segmentLabel(document.getElementById("segmento").value);
  document.getElementById("res-tipo-credito").textContent =
    document.getElementById("tipo-credito").options[document.getElementById("tipo-credito").selectedIndex].textContent?.trim() ||
    "—";
  document.getElementById("res-tabla-tipo").textContent = esAleman ? "VARIABLE" : "FIJA";
  document.getElementById("res-monto").textContent = formatMoney(result.principal);
  document.getElementById("res-monto-liq").textContent = formatMoney(result.principal);
  document.getElementById("res-plazo").textContent = String(months);
  document.getElementById("res-frecuencia").textContent = frequencyLabel(freq);
  document.getElementById("res-tna").textContent = `${annualNominal.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} %`;
  document.getElementById("res-tea").textContent = `${result.teaPct.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

  document.getElementById("res-seguro-total").textContent = formatMoney(result.totals.seguroDesgravamen);
  document.getElementById("res-aporte").textContent = formatMoney(result.totals.aporteReservas);
  document.getElementById("res-contribucion").textContent = formatMoney(result.totals.contribucionEstadoSOLCA);
  document.getElementById("res-interes-total").textContent = formatMoney(result.totals.interesGenerado);
  document.getElementById("res-carga-fin").textContent = formatMoney(result.totals.totalCargaFinancieraCompleta);
  document.getElementById("res-suma-total-global").textContent = formatMoney(result.totals.sumaCreditoMasCargaGlobal);

  document.getElementById("res-cuota-pi-label").textContent = esAleman ? LABEL_CUOTA_PI_DE : LABEL_CUOTA_PI_FR;
  if (esAleman && "cuotaCapitalFijoAproximado" in result) {
    document.getElementById("res-cuota-pi").textContent = formatMoney(result.cuotaCapitalFijoAproximado);
  } else if ("cuotaPiFija" in result) {
    document.getElementById("res-cuota-pi").textContent = formatMoney(result.cuotaPiFija);
  } else {
    document.getElementById("res-cuota-pi").textContent = "—";
  }
  document.getElementById("res-cuota-promedio").textContent = formatMoney(result.totals.cuotaPromedioReferencial);

  const discEl = document.getElementById("res-disclaimer-text");
  if (discEl) discEl.textContent = esAleman ? DISCLAIMER_DE : DISCLAIMER_FR;

  tableBody.innerHTML = "";
  result.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.no}</td>
      <td>${formatMoney(row.saldoInicial)}</td>
      <td>${formatMoney(row.capital)}</td>
      <td>${formatMoney(row.interes)}</td>
      <td>${formatMoney(row.seguro)}</td>
      <td>${formatMoney(row.cuota)}</td>
    `;
    tableBody.appendChild(tr);
  });

  creditResults.classList.remove("hidden");
  creditResults.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
