import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPreferredLanguage } from '@/ui/i18n/i18n'

// AC-044 / TEST-I18N-001: el español es el idioma por defecto aunque el navegador esté en inglés.
describe('readPreferredLanguage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('arranca en español en el primer uso aunque el navegador esté en inglés', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'en-US' })
    expect(readPreferredLanguage()).toBe('es')
  })

  it('respeta el idioma elegido y guardado por la persona', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'es-ES' })
    window.localStorage.setItem('cc.language', 'en')
    expect(readPreferredLanguage()).toBe('en')
  })
})
