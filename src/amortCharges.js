/**
 * Tasas aplicables sobre monto solicitado para aporte y contribuciones (no van en cada fila de cuota típico).
 */

/** Tipos valor en `<select id="tipo-credito">` */
export function getChargesForCreditoTipo(tipoCreditoValue) {
  switch (tipoCreditoValue) {
    case "corpo":
      return { reserveRatio: 0.01, solcaRatio: 0.005 };
    case "aho":
    case "eme":
    default:
      return { reserveRatio: 0.015, solcaRatio: 0.005 };
  }
}
