// Genera los extractos de ejemplo FICTICIOS de public/samples/ (CSV por banco + XLSX).
// Uso: node scripts/generate-samples.mjs
// Determinista: sin aleatoriedad ni fecha actual, así los ficheros no cambian entre ejecuciones.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'samples')
mkdirSync(OUT, { recursive: true })

const OPENING_BALANCE = 325000 // céntimos, a 31/07/2026
const ACCOUNT = 'ES00 0000 0000 00 0000000000' // IBAN ficticio
const HOLDER = 'TITULAR FICTICIO DE PRUEBA'

// ---------- Movimientos base (céntimos; negativo = gasto) ----------
const MONTHS = [
  { y: 2026, m: 8, groceries: [4730, 6215, 3890, 5120], energy: 5840, fuel: 5510, pharmacy: 1285, dining: 3260, amazon: 2499 },
  { y: 2026, m: 9, groceries: [5240, 4410, 6780, 3955], energy: 6125, fuel: 4980, pharmacy: 940, dining: 4150, amazon: 1899 },
  { y: 2026, m: 10, groceries: [4980, 5530, 4120, 6305], energy: 7210, fuel: 5870, pharmacy: 1560, dining: 2890, amazon: 3499 },
]

function buildMovements() {
  const list = []
  const add = (y, m, d, concept, cents) => list.push({ y, m, d, concept, cents })
  MONTHS.forEach((mo, i) => {
    const { y, m } = mo
    add(y, m, 1, 'TRANSFERENCIA ALQUILER PISO', -75000)
    add(y, m, 2, 'RECIBO ENDESA ENERGIA', -mo.energy)
    add(y, m, 3, 'NETFLIX.COM', -1299)
    add(y, m, 5, 'SPOTIFY AB', -1099)
    ;[4, 11, 18, 25].forEach((d, k) => add(y, m, d, 'COMPRA TARJ. MERCADONA S.A.', -mo.groceries[k]))
    add(y, m, 9, 'REPSOL ESTACION SERVICIO', -mo.fuel)
    add(y, m, 12, 'CAFETERIA EL RINCON', -180)
    if (i === 1) add(y, m, 12, 'CAFETERIA EL RINCON', -180) // dos idénticos el mismo día: ambos son legítimos
    add(y, m, 14, 'FARMACIA GARCIA', -mo.pharmacy)
    add(y, m, 16, 'BIZUM DE MARIA LOPEZ', 2000)
    add(y, m, 20, 'AMAZON EU SARL', -mo.amazon)
    add(y, m, 22, 'RESTAURANTE LA PLAZA', -mo.dining)
    add(y, m, 27, 'NÓMINA EMPRESA EJEMPLO SL', 185000)
    add(y, m, 28, 'TRANSFERENCIA A CUENTA AHORRO', -120000) // >= 1.000: prueba el separador de miles
    if (i === 2) add(y, m, 25, 'DEVOLUCION AMAZON EU SARL', 2499) // reembolso: positivo en categoría de gasto
  })
  // Orden cronológico estable (misma fecha: orden de inserción) + saldo tras cada movimiento
  const sorted = list
    .map((t, idx) => ({ ...t, idx }))
    .sort((a, b) => a.y - b.y || a.m - b.m || a.d - b.d || a.idx - b.idx)
  let balance = OPENING_BALANCE
  return sorted.map((t) => {
    balance += t.cents
    return { ...t, balance }
  })
}

const chronological = buildMovements()
const newestFirst = [...chronological].reverse()

// ---------- Formateadores ----------
const pad = (n) => String(n).padStart(2, '0')
const dmy = (t, sep = '/') => `${pad(t.d)}${sep}${pad(t.m)}${sep}${t.y}`
const valueDay = (t) => ({ ...t, d: Math.min(t.d + 1, 28) }) // fecha valor = día siguiente (tope 28)
const excelSerial = (t) => (Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(1899, 11, 30)) / 86400000
const utcDate = (t) => new Date(Date.UTC(t.y, t.m - 1, t.d))

/** 123456 -> "1.234,56" (coma decimal, punto de miles). */
function es(cents, { thousands = true } = {}) {
  const abs = Math.abs(cents)
  let int = String(Math.floor(abs / 100))
  if (thousands) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cents < 0 ? '-' : ''}${int},${pad(abs % 100)}`
}
/** 123456 -> "1,234.56" (formato anglosajón). */
function en(cents) {
  const abs = Math.abs(cents)
  const int = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${cents < 0 ? '-' : ''}${int}.${pad(abs % 100)}`
}
const quote = (s) => `"${s.replaceAll('"', '""')}"`
const csv = (rows, sep = ';', eol = '\n') => rows.map((r) => r.join(sep)).join(eol) + eol

function write(name, content, encoding) {
  const buf = encoding === 'windows-1252' ? Buffer.from(content, 'latin1') : Buffer.from(content, 'utf8')
  writeFileSync(join(OUT, name), buf)
}

// ---------- BBVA: UTF-8 con BOM, preámbulo, cabecera con puntos y "Disponible" ----------
write(
  'bbva.csv',
  '﻿' +
    csv(
      [
        ['Titular:', HOLDER],
        ['Cuenta:', ACCOUNT],
        ['Periodo:', '01/08/2026 - 31/10/2026'],
        [''],
        ['F.Valor', 'Fecha', 'Concepto', 'Movimiento', 'Importe', 'Divisa', 'Disponible', 'Observaciones'],
        ...newestFirst.map((t) => [
          dmy(valueDay(t)), dmy(t), t.concept, t.cents < 0 ? 'Pago con tarjeta / recibo' : 'Abono',
          es(t.cents), 'EUR', es(t.balance), '',
        ]),
      ],
      ';',
      '\r\n',
    ),
)

// ---------- Santander: UTF-8, "Divisa" duplicada, U+2212 en algunos gastos, fechas con guion ----------
write(
  'santander.csv',
  csv([
    ['Fecha Operación', 'Fecha Valor', 'Concepto', 'Importe', 'Divisa', 'Saldo', 'Divisa'],
    ...newestFirst.map((t, i) => {
      let amount = es(t.cents, { thousands: false })
      if (t.cents < 0 && i % 9 === 0) amount = amount.replace('-', '−') // signo menos tipográfico
      return [dmy(t, '-'), dmy(valueDay(t), '-'), t.concept, amount, 'EUR', es(t.balance, { thousands: false }), 'EUR']
    }),
  ]),
)

// ---------- CaixaBank: Windows-1252, fila 1 de aviso, Debe/Haber, campo con ";" entre comillas ----------
write(
  'caixabank.csv',
  csv(
    [
      ['Importes expresados en euros'],
      ['Fecha', 'Fecha valor', 'Movimiento', 'Más datos', 'Debe', 'Haber', 'Saldo'],
      ...chronological.map((t) => {
        let more = ''
        if (t.concept.startsWith('TRANSFERENCIA A CUENTA')) more = quote('Ahorro; traspaso mensual')
        else if (t.concept.startsWith('NÓMINA')) more = 'Nómina mensual'
        return [
          dmy(t), dmy(valueDay(t)), t.concept, more,
          t.cents < 0 ? es(-t.cents) : '', t.cents > 0 ? es(t.cents) : '', es(t.balance),
        ]
      }),
    ],
    ';',
    '\r\n',
  ),
  'windows-1252',
)

// ---------- ING: UTF-8, metadatos, cabecera en MAYÚSCULAS con (€), campo multilínea entre comillas ----------
write(
  'ing.csv',
  csv(
    [
      ['Número de cuenta:', ACCOUNT],
      ['Titular:', HOLDER],
      ['Fecha exportación:', '01/11/2026'],
      [''],
      ['F. VALOR', 'CATEGORÍA', 'SUBCATEGORÍA', 'DESCRIPCIÓN', 'COMENTARIO', 'IMPORTE (€)', 'SALDO (€)'],
      ...newestFirst.map((t) => [
        dmy(t), t.cents < 0 ? 'Compras' : 'Ingresos', '', t.concept,
        t.concept.startsWith('RESTAURANTE') ? quote('Cena con amigos\nmesa para 4') : '',
        es(t.cents), es(t.balance),
      ]),
    ],
    ';',
    '\r\n',
  ),
)

// ---------- Sabadell: UTF-8, metadatos, importes anglosajones, fórmula en concepto, fila de totales ----------
{
  const totalIn = chronological.filter((t) => t.cents > 0).reduce((s, t) => s + t.cents, 0)
  const totalOut = chronological.filter((t) => t.cents < 0).reduce((s, t) => s + t.cents, 0)
  write(
    'sabadell.csv',
    csv([
      ['Cuenta:', ACCOUNT],
      ['Divisa:', 'EUR'],
      ['Titular:', HOLDER],
      ['Selección: Desde 01/08/2026 hasta 31/10/2026'],
      [''],
      ['F. Operativa', 'Concepto', 'F. Valor', 'Importe', 'Saldo', 'Referencia 1', 'Referencia 2'],
      ...chronological.map((t, i) => [
        dmy(t),
        i === 5 ? '=HYPERLINK("http://example.invalid","MERCADONA")' : t.concept, // inyección de fórmula inofensiva
        dmy(valueDay(t)), en(t.cents), en(t.balance), `REF${1000 + i}`, '',
      ]),
      ['', 'TOTAL INGRESOS', '', en(totalIn), '', '', ''],
      ['', 'TOTAL GASTOS', '', en(totalOut), '', '', ''],
    ]),
  )
}

// ---------- XLSX ----------
async function xlsxBbva() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Informe BBVA')
  ws.getCell('B1').value = HOLDER
  ws.getCell('B2').value = ACCOUNT
  ws.getCell('B3').value = 'Periodo: 01/08/2026 - 31/10/2026'
  // Cabecera en la fila 5 y en la columna B (columna A vacía); fechas como celdas de fecha
  ws.getRow(5).values = [undefined, 'F.Valor', 'Fecha', 'Concepto', 'Movimiento', 'Importe', 'Divisa', 'Disponible', 'Observaciones']
  newestFirst.forEach((t, i) => {
    ws.getRow(6 + i).values = [
      undefined, utcDate(valueDay(t)), utcDate(t), t.concept,
      t.cents < 0 ? 'Pago con tarjeta / recibo' : 'Abono', t.cents / 100, 'EUR', t.balance / 100, '',
    ]
  })
  ws.getColumn(2).numFmt = 'dd/mm/yyyy'
  ws.getColumn(3).numFmt = 'dd/mm/yyyy'
  await wb.xlsx.writeFile(join(OUT, 'bbva.xlsx'))
}

async function xlsxIng() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Movimientos')
  ws.addRow(['Número de cuenta:', ACCOUNT])
  ws.addRow(['Titular:', HOLDER])
  ws.addRow(['Fecha exportación:', '01/11/2026'])
  ws.addRow(['F. VALOR', 'CATEGORÍA', 'SUBCATEGORÍA', 'DESCRIPCIÓN', 'COMENTARIO', 'IMPORTE (€)', 'SALDO (€)'])
  // Fechas como número de serie de Excel (formato General) e importes numéricos
  newestFirst.forEach((t) => {
    ws.addRow([excelSerial(t), t.cents < 0 ? 'Compras' : 'Ingresos', '', t.concept, '', t.cents / 100, t.balance / 100])
  })
  await wb.xlsx.writeFile(join(OUT, 'ing.xlsx'))
}

await xlsxBbva()
await xlsxIng()
console.log(`Muestras generadas en ${OUT}: ${chronological.length} movimientos por banco`)
console.log(`Saldo final esperado: ${es(chronological.at(-1).balance)}`)
