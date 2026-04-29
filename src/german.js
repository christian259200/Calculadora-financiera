/** Amortización alemana: capital (amortización) constante cada periodo, interés sobre saldo inicial. */

import { periodicParamsFromAnnualTna, round2, teaFromTnaCompoundedMonthly } from "./frances.js";

/** En tablas institucionales el seguro de la cuota aparece ligado al interés (ej. 10%). */
export const GERMAN_SEGURO_FRACCION_DEL_INTERES = 0.1;

/**
 * @param {object} opts
 * @param {number} opts.principal
 * @param {number} opts.months
 * @param {number} opts.annualNominalPercent
 * @param {'mensual'|'bimestral'|'trimestral'} [opts.frequency]
 * @param {number} [opts.seguroFraccionDelInteres] default 10%
 * @param {number} opts.reserveRatio
 * @param {number} opts.solcaRatio
 */
export function buildGermanSchedule(opts) {
  const {
    principal,
    months,
    annualNominalPercent,
    frequency = "mensual",
    seguroFraccionDelInteres = GERMAN_SEGURO_FRACCION_DEL_INTERES,
    reserveRatio,
    solcaRatio,
    includeReserveAndTaxCharges = true,
  } = opts;

  const freqParams = periodicParamsFromAnnualTna(months, annualNominalPercent, frequency);
  const { periods, periodicRate: i, monthsPerPeriod } = freqParams;

  const capRounded = Math.floor(round2(principal / periods) * 100) / 100;

  const rows = [];
  let balance = principal;

  for (let k = 1; k <= periods; k++) {
    const opening = balance;

    const interes = round2(opening * i);
    let capital;
    if (k < periods) {
      capital = capRounded;
    } else {
      capital = round2(opening);
    }

    const seguro = round2(interes * seguroFraccionDelInteres);
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

    balance = round2(opening - capital);
  }

  const totalInteres = round2(rows.reduce((s, r) => s + r.interes, 0));
  const totalSeguro = round2(rows.reduce((s, r) => s + r.seguro, 0));
  const totalCapital = round2(rows.reduce((s, r) => s + r.capital, 0));

  const sumaPorCuotas = round2(rows.reduce((s, r) => s + r.cuota, 0));
  const aporteReservas = includeReserveAndTaxCharges ? round2(principal * reserveRatio) : 0;
  const contribSolid = includeReserveAndTaxCharges ? round2(principal * solcaRatio) : 0;

  const totalCargaFinancieraCompleta = round2(totalInteres + totalSeguro + aporteReservas + contribSolid);
  const sumaCreditoMasCarga = round2(principal + totalCargaFinancieraCompleta);
  const cuotaPromMed = round2(sumaPorCuotas / periods);
  const teaPct = teaFromTnaCompoundedMonthly(annualNominalPercent);

  return {
    metodo: "aleman",
    tablaAmortizacion: "VARIABLE",
    principal: round2(principal),
    months,
    periods,
    frequency,
    annualNominalPercent,
    periodicRate: i,
    monthsPerPeriod,
    seguroFraccionDelInteres,
    cuotaCapitalFijoAproximado: capRounded,
    teaPct,
    rows,
    totals: {
      interesGenerado: totalInteres,
      seguroDesgravamen: totalSeguro,
      sumaCapital: totalCapital,
      sumaSinCargosUnicosTabla: sumaPorCuotas,
      aporteReservas,
      contribucionEstadoSOLCA: contribSolid,
      totalCargaFinancieraCompleta,
      sumaCreditoMasCargaGlobal: sumaCreditoMasCarga,
      cuotaPromedioReferencial: cuotaPromMed,
    },
  };
}
