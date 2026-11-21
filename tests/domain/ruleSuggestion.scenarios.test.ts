import { describe, expect, it } from 'vitest'
import { UNCATEGORIZED, type CategoryId } from '@/domain/category/Category'
import { suggestRule, type SuggestionHistoryItem } from '@/domain/rule/ruleSuggestion'
import { matchesRulePattern } from '@/domain/rule/wordMatch'
import { normalizeText } from '@/domain/shared/normalizeText'
import type { Transaction, TransactionId } from '@/domain/transaction/Transaction'
import { money, tx as buildTx } from './builders'

const C = (s: string) => s as CategoryId
const U = UNCATEGORIZED
const GROC = C('super'), REST = C('restaurantes'), TRANS = C('transporte'), FUEL = C('gasolina'), UTIL = C('suministros'),
  SUBS = C('suscripciones'), SHOP = C('compras'), SAL = C('nomina'), CASH = C('efectivo'), FEES = C('comisiones'),
  FAM = C('familia'), RENT = C('alquiler'), INS = C('seguros'), SAVE = C('ahorro'), HEALTH = C('salud')

let n = 0
const h = (desc: string, cat: CategoryId = U): SuggestionHistoryItem => ({ id: `h${n++}` as TransactionId, normalizedDescription: normalizeText(desc), categoryId: cat })
const tx = (desc: string, cents = -1000): Transaction => buildTx({ id: 'tx-target' as TransactionId, normalizedDescription: normalizeText(desc), amount: money(cents) })
const rep = (k: number, f: (i: number) => SuggestionHistoryItem) => Array.from({ length: k }, (_, i) => f(i))

// Histórico base realista (~120 movimientos de un año, mitad sin categorizar)
const base: SuggestionHistoryItem[] = [
  ...rep(6, (i) => h(`COMPRA TARJ ****1234 MERCADONA ${2000 + i} VALENCIA`, i % 2 ? GROC : U)),
  ...rep(4, (i) => h(`COMPRA TARJ ****1234 CARREFOUR EXPRESS ${100 + i} MADRID`, i % 2 ? GROC : U)),
  ...rep(3, () => h('COMPRA TARJ ****1234 LIDL SUPERMERCADOS 0456 VALENCIA', GROC)),
  ...rep(4, (i) => h(`APPLE PAY COMPRA BAR MANOLO VALENCIA`, i % 2 ? REST : U)),
  ...rep(3, () => h('COMPRA TARJ ****1234 BAR LA PLAZA VALENCIA', REST)),
  ...rep(5, (i) => h(`BIZUM ENVIADO A JUAN PEREZ GARCIA CONCEPTO CENA ${i}`, i % 2 ? REST : U)),
  ...rep(3, () => h('BIZUM RECIBIDO DE JUAN PEREZ GARCIA CONCEPTO DEVOLUCION', U)),
  ...rep(4, () => h('BIZUM ENVIADO A MARIA LOPEZ CONCEPTO REGALO', FAM)),
  ...rep(4, () => h('BIZUM RECIBIDO DE MARIA LOPEZ CONCEPTO LOTERIA', U)),
  ...rep(6, () => h('RECIBO IBERDROLA CLIENTES SAU', UTIL)),
  ...rep(6, () => h('RECIBO NATURGY IBERIA SA GAS', UTIL)),
  ...rep(3, () => h('RECIBO CANAL DE ISABEL II', UTIL)),
  ...rep(6, () => h('TRANSFERENCIA A FAVOR DE PEDRO RUIZ ALQUILER PISO', RENT)),
  ...rep(3, () => h('TRANSFERENCIA A FAVOR DE CUENTA AHORRO PROPIA', SAVE)),
  ...rep(3, () => h('TRANSFERENCIA INMEDIATA A FAVOR DE LAURA GOMEZ', U)),
  ...rep(6, () => h('NOMINA ACME SOLUTIONS SL', SAL)),
  ...rep(6, (i) => h(`PAYPAL *NETFLIX ${i}`, i % 2 ? SUBS : U)),
  ...rep(3, () => h('PAYPAL *ALIEXPRESS', SHOP)),
  ...rep(2, () => h('PAYPAL *VINTED', U)),
  ...rep(5, (i) => h(`AMAZON MKTPLACE ES*AB12CD${30 + i}`, i % 2 ? SHOP : U)),
  ...rep(3, () => h('AMAZON PRIME ES', SUBS)),
  ...rep(3, () => h('AMAZON MUSIC', SUBS)),
  ...rep(4, (i) => h(`GLOVO*PEDIDO ${1000 + i} MADRID`, U)),
  ...rep(4, () => h('UBER *TRIP HELP.UBER.COM', TRANS)),
  ...rep(4, () => h('UBER EATS PEDIDO', REST)),
  ...rep(4, () => h('REPSOL ESTACION SERVICIO 1234 VALENCIA', FUEL)),
  ...rep(3, () => h('CEPSA E.S. AVDA DEL PUERTO', FUEL)),
  ...rep(4, () => h('REINTEGRO CAJERO 1234 BBVA VALENCIA', CASH)),
  ...rep(3, () => h('RECIBO BBVA SEGUROS VIDA', INS)),
  ...rep(3, () => h('COMISION MANTENIMIENTO CUENTA', FEES)),
  ...rep(3, () => h('TRASPASO CUENTA AHORRO', SAVE)),
  ...rep(3, () => h('ADEUDO SPOTIFY P1234ABCD', SUBS)),
  ...rep(3, () => h('COMPRA TARJ ****1234 FARMACIA LDA MARIA GARCIA', HEALTH)),
  ...rep(4, () => h('GOOGLE *YOUTUBE PREMIUM', SUBS)),
  ...rep(2, () => h('GOOGLE PAY COMPRA ZARA MADRID', SHOP)),
]
const BIG = (extra: SuggestionHistoryItem[] = []) => [...base, ...extra]
const small = (...xs: SuggestionHistoryItem[]) => xs

interface Sc { id: number; name: string; desc: string; cat: CategoryId; hist: SuggestionHistoryItem[] }
const sc: Sc[] = [
  { id: 1, name: 'Mercadona otra tienda', desc: 'COMPRA TARJ ****1234 MERCADONA 2345 VALENCIA', cat: GROC, hist: BIG() },
  { id: 2, name: 'Mercadona usuario muy frecuente (cap 5%)', desc: 'COMPRA TARJ ****1234 MERCADONA 2345 VALENCIA', cat: GROC,
    hist: BIG(rep(20, (i) => h(`COMPRA TARJ ****1234 MERCADONA ${3000 + i} ALBORAYA`, GROC))) },
  { id: 3, name: 'Apple Pay cafetería, histórico pequeño con MADRID sin categoría', desc: 'APPLE PAY COMPRA CAFETERIA LOLA MADRID', cat: REST,
    hist: small(...rep(6, () => h('GLOVO*PEDIDO MADRID')), ...rep(3, () => h('CARREFOUR EXPRESS MADRID'))) },
  { id: 4, name: 'Bizum enviado a Juan (cena)', desc: 'BIZUM ENVIADO A JUAN PEREZ GARCIA CONCEPTO CENA', cat: REST, hist: BIG() },
  { id: 5, name: 'Bizum recibido de María (familia)', desc: 'BIZUM RECIBIDO DE MARIA LOPEZ CONCEPTO CUMPLE', cat: FAM, hist: BIG() },
  { id: 6, name: 'Recibo Iberdrola', desc: 'RECIBO IBERDROLA CLIENTES SAU REF 99881', cat: UTIL, hist: BIG() },
  { id: 7, name: 'Recibo Naturgy sin histórico', desc: 'RECIBO NATURGY IBERIA SA', cat: UTIL, hist: [] },
  { id: 8, name: 'Transferencia alquiler', desc: 'TRANSFERENCIA A FAVOR DE PEDRO RUIZ ALQUILER PISO', cat: RENT, hist: BIG() },
  { id: 9, name: 'Transferencia inmediata, sin histórico', desc: 'TRANSFERENCIA INMEDIATA A FAVOR DE LAURA GOMEZ', cat: FAM, hist: [] },
  { id: 10, name: 'Nómina', desc: 'NOMINA ACME SOLUTIONS SL', cat: SAL, hist: BIG() },
  { id: 11, name: 'Transferencia recibida nómina, sin histórico', desc: 'TRANSFERENCIA RECIBIDA NOMINA ACME SOLUTIONS', cat: SAL, hist: [] },
  { id: 12, name: 'PayPal *NETFLIX (histórico grande)', desc: 'PAYPAL *NETFLIX', cat: SUBS, hist: BIG() },
  { id: 13, name: 'PayPal *NETFLIX con histórico PayPal sin categorizar', desc: 'PAYPAL *NETFLIX', cat: SUBS,
    hist: small(h('PAYPAL *NETFLIX', U), h('PAYPAL *VINTED'), h('PAYPAL *EBAY'), h('PAYPAL *STEAM'), h('PAYPAL *WALLAPOP')) },
  { id: 14, name: 'Amazon marketplace', desc: 'AMAZON MKTPLACE ES*ZX98YW76', cat: SHOP, hist: BIG() },
  { id: 15, name: 'Amazon marketplace, sin histórico', desc: 'AMAZON MKTPLACE ES*ZXCVYW76', cat: SHOP, hist: [] },
  { id: 16, name: 'Amazon Prime (suscripción)', desc: 'AMAZON PRIME ES', cat: SUBS, hist: small(...rep(5, () => h('AMAZON MKTPLACE ES'))) },
  { id: 17, name: 'Glovo', desc: 'GLOVO*PEDIDO 2001 MADRID', cat: REST, hist: BIG() },
  { id: 18, name: 'Uber viaje → transporte, histórico sin categorizar con UBER EATS', desc: 'UBER *TRIP HELP.UBER.COM', cat: TRANS,
    hist: small(...rep(4, () => h('UBER EATS PEDIDO')), ...rep(2, () => h('UBER *TRIP HELP.UBER.COM'))) },
  { id: 19, name: 'Uber Eats → restaurantes', desc: 'UBER EATS PEDIDO', cat: REST, hist: BIG() },
  { id: 20, name: 'Repsol', desc: 'REPSOL ESTACION SERVICIO 9876 ALICANTE', cat: FUEL, hist: BIG() },
  { id: 21, name: 'Cepsa E.S.', desc: 'CEPSA E.S. AVDA DEL PUERTO', cat: FUEL, hist: [] },
  { id: 22, name: 'Reintegro cajero', desc: 'REINTEGRO CAJERO 5678 BBVA MADRID', cat: CASH, hist: small(...rep(3, () => h('RECIBO BBVA SEGUROS VIDA'))) },
  { id: 23, name: 'Comisión mantenimiento', desc: 'COMISION MANTENIMIENTO CUENTA', cat: FEES, hist: small(...rep(3, () => h('TRASPASO CUENTA AHORRO'))) },
  { id: 24, name: 'Comisión emisión transferencia sin histórico', desc: 'COMISION EMISION TRANSFERENCIA', cat: FEES, hist: [] },
  { id: 25, name: 'Bar genérico', desc: 'COMPRA TARJ ****1234 BAR MANOLO VALENCIA', cat: REST, hist: BIG() },
  { id: 26, name: 'Bar sin histórico', desc: 'COMPRA TARJ ****1234 BAR PACO', cat: REST, hist: [] },
  { id: 27, name: 'Spotify con referencia alfanumérica, sin histórico', desc: 'ADEUDO SPOTIFY AB12CD34EFGH', cat: SUBS, hist: [] },
  { id: 28, name: 'Farmacia de María García', desc: 'COMPRA TARJ ****1234 FARMACIA LDA MARIA GARCIA', cat: HEALTH, hist: BIG() },
  { id: 29, name: 'Seguro Mapfre sin histórico', desc: 'RECIBO SEGUROS MAPFRE ESPANA', cat: INS, hist: [] },
  { id: 30, name: 'Google Pay en Zara', desc: 'GOOGLE PAY COMPRA ZARA MADRID', cat: SHOP, hist: BIG() },
  { id: 31, name: 'YouTube Premium', desc: 'GOOGLE *YOUTUBE PREMIUM', cat: SUBS, hist: BIG() },
  { id: 32, name: 'Lidl con ciudad', desc: 'COMPRA TARJ ****1234 LIDL SUPERMERCADOS 0789 TORRENT', cat: GROC, hist: BIG() },
  { id: 33, name: 'DIA 123', desc: 'COMPRA TARJ ****1234 DIA 123', cat: GROC, hist: small(h('BIZUM ENVIADO A ANA CONCEPTO DIA DE LA MADRE'), h('PAGO DIA DEL PADRE REGALO')) },
  { id: 34, name: 'Mercadona con histórico pequeño VALENCIA uncategorized', desc: 'COMPRA TARJ ****1234 MERCADONA 2345 VALENCIA', cat: GROC,
    hist: small(...rep(8, () => h('APPLE PAY COMPRA VARIOS VALENCIA')), h('MERCADONA 1 VALENCIA', U)) },
  { id: 35, name: 'Comercio solo con dígitos/abreviado', desc: 'COMPRA TARJ ****1234 E.S. N-340 KM12', cat: FUEL, hist: [] },
]

const EXPECTED: Record<number, string | null> = {
  1: 'MERCADONA',
  2: 'MERCADONA',
  3: 'LOLA',
  4: 'JUAN',
  5: 'MARIA LOPEZ',
  6: 'IBERDROLA',
  7: 'NATURGY',
  8: 'PEDRO',
  9: 'LAURA',
  10: 'NOMINA',
  11: 'NOMINA',
  12: 'PAYPAL *NETFLIX',
  13: 'PAYPAL *NETFLIX',
  14: 'AMAZON MKTPLACE',
  15: 'AMAZON MKTPLACE',
  16: 'AMAZON PRIME',
  17: 'GLOVO*PEDIDO',
  18: 'UBER *TRIP',
  19: 'UBER EATS',
  20: 'REPSOL',
  21: 'CEPSA',
  22: null,
  23: 'COMISION',
  24: 'COMISION',
  25: 'MANOLO',
  26: 'PACO',
  27: 'SPOTIFY',
  28: 'FARMACIA',
  29: 'MAPFRE',
  30: 'ZARA',
  31: 'YOUTUBE',
  32: 'LIDL',
  33: 'DIA',
  34: 'MERCADONA',
  35: null,
}

// Escenarios del tester de reglas: patron bueno esperado (null = no hay propuesta segura).
// 33 (DIA) queda como limitacion conocida: DIA es un super real, aunque la palabra sea ambigua.
const INCOME_SCENARIOS = new Set([5, 11])

describe('suggestRule: 35 escenarios de calidad', () => {
  it.each(sc.map((s) => [`#${s.id} ${s.name}`, s] as const))('%s', (_name, s) => {
    const cents = INCOME_SCENARIOS.has(s.id) ? 1000 : -1000
    const suggestion = suggestRule(tx(s.desc, cents), s.cat, s.hist)
    expect(suggestion?.pattern ?? null).toBe(EXPECTED[s.id])
    if (suggestion === null) return
    expect(matchesRulePattern(normalizeText(s.desc), suggestion.pattern, 'contains')).toBe(true)
    expect(suggestion.amountSign).toBe(cents < 0 ? 'expense' : 'income')
  })
})
