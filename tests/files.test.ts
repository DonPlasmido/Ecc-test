import { describe, it, expect } from 'vitest'
import { checkFile, MAX_FILE_BYTES } from '../src/core/files'

describe('checkFile', () => {
  it('acepta un .xlsx normal', () => {
    expect(checkFile({ name: 'datos.xlsx', size: 1000 }, 'excel')).toEqual({ ok: true, warnings: [] })
  })

  it('acepta mayúsculas en la extensión', () => {
    expect(checkFile({ name: 'DATOS.XLSX', size: 10 }, 'excel').ok).toBe(true)
  })

  it('avisa (sin rechazar) de que las macros de un .xlsm se perderán', () => {
    const r = checkFile({ name: 'macro.xlsm', size: 10 }, 'excel')
    expect(r.ok).toBe(true)
    expect(r.ok && r.warnings[0]).toMatch(/macros/i)
  })

  it('rechaza el formato antiguo .xls con una explicación', () => {
    const r = checkFile({ name: 'viejo.xls', size: 10 }, 'excel')
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/\.xlsx/) })
  })

  it('rechaza el formato antiguo .doc con una explicación', () => {
    const r = checkFile({ name: 'viejo.doc', size: 10 }, 'word')
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/\.docx/) })
  })

  it('rechaza un Word donde se espera un Excel', () => {
    expect(checkFile({ name: 'carta.docx', size: 10 }, 'excel').ok).toBe(false)
  })

  it('acepta un .docx donde se espera un Word', () => {
    expect(checkFile({ name: 'plantilla.docx', size: 10 }, 'word').ok).toBe(true)
  })

  it('rechaza archivos más grandes del límite', () => {
    const r = checkFile({ name: 'enorme.xlsx', size: MAX_FILE_BYTES + 1 }, 'excel')
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/grande/) })
  })

  it('rechaza archivos vacíos', () => {
    expect(checkFile({ name: 'vacio.xlsx', size: 0 }, 'excel').ok).toBe(false)
  })
})
