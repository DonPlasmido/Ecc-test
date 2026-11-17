import { describe, it, expect } from 'vitest'
import PizZip from 'pizzip'
import { fillTemplates, templateTags, zipFiles } from '../src/io/word'
import type { Table } from '../src/core/table'
import { docxParagraphs, makeDocx } from './helpers'

const plantilla = makeDocx(['Hola {Nombre},', 'Debes {Importe} € desde el {Fecha}.'])

const clientes: Table = {
  headers: ['Nombre', 'Importe', 'Fecha', 'Ciudad'],
  rows: [
    ['Ana', 1234.5, new Date(Date.UTC(2024, 2, 5)), 'Madrid'],
    ['Luis', 20, null, 'Sevilla'],
  ],
}

describe('templateTags', () => {
  it('devuelve los huecos {…} que usa la plantilla', () => {
    expect(templateTags(plantilla)).toEqual(['Nombre', 'Importe', 'Fecha'])
  })

  it('da un error claro si una llave está mal cerrada', () => {
    expect(() => templateTags(makeDocx(['Hola {Nombre'])))
      .toThrow(/llaves/)
  })

  it('da un error claro si el archivo no es un Word válido', () => {
    expect(() => templateTags(new TextEncoder().encode('nada').buffer as ArrayBuffer)).toThrow(/no se pudo leer/i)
  })
})

describe('fillTemplates', () => {
  it('crea un documento por fila con los datos puestos en los huecos', () => {
    const { files } = fillTemplates(plantilla, clientes)
    expect(files).toHaveLength(2)
    expect(docxParagraphs(files[0]!.data)).toEqual(['Hola Ana,', 'Debes 1234,5 € desde el 05/03/2024.'])
    expect(docxParagraphs(files[1]!.data)).toEqual(['Hola Luis,', 'Debes 20 € desde el .'])
  })

  it('empareja los huecos con las columnas sin importar mayúsculas ni espacios', () => {
    const t = makeDocx(['{ nombre } de {CIUDAD}'])
    const { files } = fillTemplates(t, clientes)
    expect(docxParagraphs(files[0]!.data)).toEqual(['Ana de Madrid'])
  })

  it('nombra los archivos con la columna elegida y evita repetidos', () => {
    const t: Table = { headers: ['Nombre'], rows: [['Ana'], ['Ana'], ['Luis/Pérez']] }
    const { files } = fillTemplates(makeDocx(['{Nombre}']), t, { fileNameColumn: 0 })
    expect(files.map((f) => f.name)).toEqual(['Ana.docx', 'Ana (2).docx', 'Luis-Pérez.docx'])
  })

  it('numera los archivos si no se elige columna para el nombre', () => {
    const { files } = fillTemplates(plantilla, clientes)
    expect(files.map((f) => f.name)).toEqual(['documento-1.docx', 'documento-2.docx'])
  })

  it('se salta las filas vacías', () => {
    const t: Table = { headers: ['Nombre'], rows: [['Ana'], [null], ['  ']] }
    expect(fillTemplates(makeDocx(['{Nombre}']), t).files).toHaveLength(1)
  })

  it('da un error claro si la plantilla usa una columna que el Excel no tiene', () => {
    expect(() => fillTemplates(makeDocx(['{Nombre} {Teléfono} {Email}']), clientes))
      .toThrow('La plantilla usa columnas que el Excel no tiene: «Teléfono», «Email».')
  })

  it('da un error claro si la plantilla no tiene huecos', () => {
    expect(() => fillTemplates(makeDocx(['Sin huecos']), clientes)).toThrow(/no tiene ningún hueco/)
  })

  it('da un error claro si el Excel no tiene filas con datos', () => {
    expect(() => fillTemplates(plantilla, { headers: clientes.headers, rows: [] })).toThrow(/no tiene filas/)
  })
})

describe('zipFiles', () => {
  it('mete todos los documentos en un .zip', () => {
    const { files } = fillTemplates(plantilla, clientes)
    const zip = new PizZip(zipFiles(files))
    expect(Object.keys(zip.files).sort()).toEqual(['documento-1.docx', 'documento-2.docx'])
  })
})
