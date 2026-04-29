/**
 * Amortización tipo francés: TNA repartida en periodos iguales según frecuencia.
 * Seguro desgravamen: porcentaje del saldo al inicio de cada fila de la tabla,
 * aplicado una sola vez por cuota (no multiplica por meses del periodo).
 */

/** Redondeo hacia abajo a 2 decimales (cuota fija P+I institucional). */
export function floor2(n) {
  return Math.floor(n * 100) / 100;
}

/** Redondeo al centavo más cercano. */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Tasa periódica mensual a partir de TNA (nominal anual %), dividida en 12.
 * @param {number} annualNominalPercent ej. 12.77
 */
export function monthlyRateFromTna(annualNominalPercent) {
  return annualNominalPercent / 100 / 12;
}

/**
 * TEA típico (capitalización mensual sobre TNA): (1+i_m)^12 - 1, en % redondeado.
 * Coherente con tablas donde TNA 12.77% → ~13.54%.
 */
export function teaFromTnaCompoundedMonthly(tnaPercent) {
  const im = tnaPercent / 100 / 12;
  return round2((Math.pow(1 + im, 12) - 1) * 100);
}

/**
 * Cuota fija capital + interés (sistema francés), sin seguro.
 */
export function frenchPrincipalInterestPayment(principal, periods, periodicRate) {
  if (principal <= 0 || periods <= 0) throw new Error("Monto y plazo deben ser positivos");
  const i = periodicRate;
  if (i <= 0) throw new Error("La tasa debe ser mayor que cero");
  const factor = Math.pow(1 + i, periods);
  return principal * ((i * factor) / (factor - 1));
}

export function parsePercentFromOptionText(text) {
  const m = text.match(/(\d+(?:[\.,]\d+)?)\s*%/);
  if (!m) return null;
  return parseFloat(String(m[1]).replace(",", "."), 10);
}

/**
 * TNA nominal anual repartida entre pagos: mensual n/12, bimensual n/6, trimestral n/4.
 */
export function periodicParamsFromAnnualTna(monthsTotal, annualNominalPercent, frequency) {
  const r = annualNominalPercent / 100;

  switch (frequency) {
    case "mensual": {
      const periods = Math.round(monthsTotal);
      if (!(periods > 0)) throw new Error("Plazo invalido.");
      return { periods, periodicRate: r / 12, monthsPerPeriod: 1 };
    }
    case "bimestral": {
      if (monthsTotal % 2 !== 0) {
        throw new Error("Para BIMENSUAL el plazo (meses) debe ser múltiplo de 2.");
      }
      const periods = monthsTotal / 2;
      return { periods, periodicRate: r / 6, monthsPerPeriod: 2 };
    }
    case "trimestral": {
      if (monthsTotal % 3 !== 0) {
        throw new Error("Para TRIMESTRAL el plazo (meses) debe ser múltiplo de 3.");
      }
      const periods = monthsTotal / 3;
      return { periods, periodicRate: r / 4, monthsPerPeriod: 3 };
    }
    default:
      throw new Error("Frecuencia no soportada.");
  }
}

/**
 * @typedef {Object} FrancesRow
 * @property {number} no
 * @property {number} saldoInicial
 * @property {number} capital
 * @property {number} interes
 * @property {number} seguro
 * @property {number} cuotaPi
 * @property {number} cuota
 */

/**
 * Coeficiente de seguro desgravamen sobre saldo al inicio de cada cuota documentada en tablas.
 * (Antes erróneo: ρ_mensual × meses-del-periodo hinchaba demasiado el seguro.)
 */
export const SEGURO_SALDO_POR_FRECUENCIA = {
  mensual: 1.54 / 2500,
  bimestral: Math.sqrt((1.54 / 2500) * (2.2 / 3500)),
  trimestral: 2.2 / 3500,
};

/** Aporte reservas y SOLCA como % sobre monto referencia institucional (ej. Consumo ord./prior.). */
export const APORTE_RESERVAS_RATIO = 0.015;
export const SOLCA_CONTRIB_RATIO = 0.005;

/**
 * @param {object} opts
 * @param {number} opts.principal
 * @param {number} opts.months
 * @param {number} opts.annualNominalPercent TNA %
 * @param {'mensual' | 'bimestral' | 'trimestral'} opts.frequency
 * @param {number} [opts.insuranceSaldoCoefficient] Sobrescribe el factor ρ según simulaciones reales del producto
 * @param {boolean} [opts.includeReserveAndTaxCharges] Sumar filas tipo aporte y SOLCA al resumen (no entran fila a fila)
 */
export function buildFrenchSchedule(opts) {
  const {
    principal,
    months,
    annualNominalPercent,
    frequency = "mensual",
    insuranceSaldoCoefficient,
    includeReserveAndTaxCharges = true,
    reserveRatio = APORTE_RESERVAS_RATIO,
    solcaRatio = SOLCA_CONTRIB_RATIO,
  } = opts;

  const coefSeguroSaldo =
    insuranceSaldoCoefficient !== undefined ? insuranceSaldoCoefficient : SEGURO_SALDO_POR_FRECUENCIA[frequency];
  if (coefSeguroSaldo == null) throw new Error("Frecuencia no válida.");

  const freqParams = periodicParamsFromAnnualTna(months, annualNominalPercent, frequency);
  const { periods, periodicRate: i, monthsPerPeriod } = freqParams;

  const rawPmtPi = frenchPrincipalInterestPayment(principal, periods, i);
  const pmtCiPlano = floor2(rawPmtPi);

  const rows /** @type {FrancesRow[]} */ = [];
  let balance = principal;

  for (let k = 1; k <= periods; k++) {
    const opening = balance;

    const interes = round2(opening * i);
    let capital;
    if (k < periods) {
      capital = round2(pmtCiPlano - interes);
    } else {
      capital = round2(opening);
    }
    /** Seguro: una sola vez por periodo de pago, proporcional al saldo (no ρ_mensual×meses). */
    const seguro = round2(opening * coefSeguroSaldo);
    const cuotaPi = round2(capital + interes);
    const cuota = round2(cuotaPi + seguro);

    rows.push({
      no: k,
      saldoInicial: round2(opening),
      capital,
      interes,
      seguro,
      cuotaPi,
      cuota,
    });

    balance = opening - capital;
  }

  const totalInteres = round2(rows.reduce((s, r) => s + r.interes, 0));
  const totalSeguro = round2(rows.reduce((s, r) => s + r.seguro, 0));
  const totalCapital = round2(rows.reduce((s, r) => s + r.capital, 0));

  /** Suma de cuotas amortizadas (solo lo que muestra cada fila): ≈ prima + gastos financieros de la tabla. */
  const sumaPorCuotas = round2(rows.reduce((s, r) => s + r.cuota, 0));

  /** Colegiatura institucional: no van en cada fila típico; se suman al costo global. */
  const aporteReservas = includeReserveAndTaxCharges ? round2(principal * reserveRatio) : 0;
  const contribucionSolidaria = includeReserveAndTaxCharges ? round2(principal * solcaRatio) : 0;

  const totalCargaFinancieraCompleta = round2(
    totalInteres + totalSeguro + aporteReservas + contribucionSolidaria
  );
  const sumaGranTotalCredito = round2(principal + totalCargaFinancieraCompleta);

  const cuotasProm = round2(rows.reduce((s, r) => s + r.cuota, 0) / periods);

  /**
   * CUOTA PROMEDIO (referencial): igual a la media aritmética de cada fila cuando no hay cargos externos en la tabla.
   * Coincide con credenciales ejemplo ~947.33 (media de 948.14…946.51), no con (capital + todas las cargos)/4 cuando aportes no están en tabla.
   */
  const cuotaPromedioTabla = cuotasProm;

  const teaPct = teaFromTnaCompoundedMonthly(annualNominalPercent);

  return {
    principal: round2(principal),
    months,
    periods,
    frequency,
    annualNominalPercent,
    periodicRate: i,
    monthsPerPeriod,
    insuranceSaldoCoefficient: coefSeguroSaldo,
    teaPct,
    cuotaPiFija: pmtCiPlano,
    rows,
    totals: {
      interesGenerado: totalInteres,
      seguroDesgravamen: totalSeguro,
      sumaCapital: totalCapital,
      /** Solo filas amortización (capital + interés + seguros de tabla). */
      sumaSinCargosUnicosTabla: sumaPorCuotas,
      /** Incluye aporte y SOLCA ejemplo consumo ordinario sobre monto solicitado. */
      aporteReservas,
      contribucionEstadoSOLCA: contribucionSolidaria,
      totalCargaFinancieraCompleta,
      /** Costo tabla + reservas + rubros institucionales (sin duplicar doble cobro tabla). */
      sumaCreditoMasCargaGlobal: sumaGranTotalCredito,
      cuotaPromedioReferencial: cuotaPromedioTabla,
    },
  };
}
