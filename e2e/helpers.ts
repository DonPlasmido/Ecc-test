import ExcelJS from 'exceljs'
import { readFile } from 'node:fs/promises'
import type { Download, Page } from '@playwright/test'

type Value = string | number | boolean | Date | null

export async function xlsxFile(name: string, rows: Value[][], sheet = 'Datos') {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheet)
  rows.forEach((r) => ws.addRow(r))
  const buffer = Buffer.from(await wb.xlsx.writeBuffer())
  return { name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer }
}

export async function readDownloadedXlsx(download: Download): Promise<Value[][]> {
  const path = await download.path()
  const wb = new ExcelJS.Workbook()
  const file = await readFile(path)
  await wb.xlsx.load(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer)
  const ws = wb.worksheets[0]!
  const rows: Value[][] = []
  ws.eachRow((row) => rows.push((row.values as Value[]).slice(1)))
  return rows
}

export async function clickDownload(page: Page, name: RegExp): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name }).click()])
  return download
}
