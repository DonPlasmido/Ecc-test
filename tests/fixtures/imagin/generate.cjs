// Extracto FICTICIO "al estilo imagin" (formato real no documentado públicamente).
const ExcelJS = require('exceljs'); const fs = require('fs'); const out = process.argv[2]
const OPENING = 820.15
const tpl = [
  [1, 'NOMINA EMPRESA FICTICIA SL', 1450.00], [1, 'TRANSFERENCIA A HUCHA IMAGIN', -100.00], [2, 'ALQUILER HABITACION', -380.00],
  [3, 'BIZUM ENVIADO A PABLO CENA', -18.50], [4, 'COMPRA APPLE PAY MERCADONA', -42.37], [5, 'SPOTIFY P1B4C2', -10.99],
  [6, 'NETFLIX.COM', -13.99], [8, 'BIZUM RECIBIDO DE LAURA ENTRADAS', 25.00], [9, 'COMPRA APPLE PAY MERCADONA', -31.80],
  [11, 'RECIBO DIGI MOBIL', -15.00], [12, 'COMPRA TARJ GLOVO*PEDIDO', -19.90], [14, 'COMPRA APPLE PAY LIDL', -27.64],
  [15, 'METRO BARCELONA T-USUAL', -21.35], [18, 'COMPRA AMAZON.ES', -35.99], [19, 'BIZUM ENVIADO A PABLO CENA', -18.50],
  [21, 'COMPRA APPLE PAY MERCADONA', -48.12], [23, 'CAFETERIA LA PLAZA', -3.20], [23, 'CAFETERIA LA PLAZA', -3.20],
  [25, 'GIMNASIO BASIC FIT', -24.99], [27, 'COMPRA TARJ ZARA', -59.95],
]
const rows = []
for (const [m, mi] of [[8, 0], [9, 1], [10, 2]]) for (const [d, c, a] of tpl) rows.push({ date: new Date(Date.UTC(2026, m - 1, d)), concept: c, amount: +(a + (/MERCADONA|LIDL|GLOVO|AMAZON/.test(c) ? mi * 1.13 * Math.sign(a) : 0)).toFixed(2) })
let bal = OPENING; for (const r of rows) { bal = +(bal + r.amount).toFixed(2); r.balance = bal }
;(async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Movimientos')
  ws.addRow(['imagin']); ws.addRow(['Movimientos de la cuenta ES00 0000 0000 0000 0000 0000 (FICTICIA)']); ws.addRow(['Del 01/08/2026 al 31/10/2026']); ws.addRow([])
  ws.addRow(['Concepto', 'Fecha', 'Importe', 'Saldo'])
  for (const r of [...rows].reverse()) ws.addRow([r.concept, r.date, r.amount, r.balance]) // más reciente primero, como las apps
  ws.getColumn(2).numFmt = 'dd/mm/yyyy'; ws.getColumn(3).numFmt = '#,##0.00 "€"'; ws.getColumn(4).numFmt = '#,##0.00 "€"'
  await wb.xlsx.writeFile(`${out}/imagin-ficticio.xlsx`)
  const fmt = (n) => n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const csv = ['Concepto;Fecha;Importe;Saldo', ...[...rows].reverse().map((r) => `${r.concept};${String(r.date.getUTCDate()).padStart(2, '0')}/${String(r.date.getUTCMonth() + 1).padStart(2, '0')}/${r.date.getUTCFullYear()};${fmt(r.amount)}EUR;${fmt(r.balance)}EUR`)].join('\r\n')
  fs.writeFileSync(`${out}/imagin-ficticio.csv`, '﻿' + csv)
  const spentOct = rows.filter((r) => r.date.getUTCMonth() === 9 && r.amount < 0).reduce((s, r) => s + r.amount, 0)
  const incomeOct = rows.filter((r) => r.date.getUTCMonth() === 9 && r.amount > 0).reduce((s, r) => s + r.amount, 0)
  console.log(JSON.stringify({ count: rows.length, finalBalance: bal, spentOct: +spentOct.toFixed(2), incomeOct: +incomeOct.toFixed(2) }))
})()
