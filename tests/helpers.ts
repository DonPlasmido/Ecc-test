import PizZip from 'pizzip'
import ExcelJS from 'exceljs'
import type { Cell } from '../src/core/table'

/** Crea un .xlsx en memoria con las filas dadas (la primera fila son los encabezados). */
export async function makeXlsx(sheets: Record<string, Cell[][]>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name)
    rows.forEach((row) => ws.addRow(row))
  }
  const buf = await wb.xlsx.writeBuffer()
  return toArrayBuffer(buf as unknown as Uint8Array)
}

export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}


const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Crea un .docx mínimo con un párrafo por cada texto. */
export function makeDocx(paragraphs: string[]): ArrayBuffer {
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`)
    .join('')
  const zip = new PizZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  )
  return toArrayBuffer(zip.generate({ type: 'uint8array' }))
}

/** Devuelve el texto de cada párrafo de un .docx. */
export function docxParagraphs(data: ArrayBuffer | Uint8Array): string[] {
  const xml = new PizZip(data).file('word/document.xml')!.asText()
  return [...xml.matchAll(/<w:p[ >].*?<\/w:p>/g)].map(([p]) =>
    [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''),
  )
}
