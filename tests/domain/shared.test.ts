import { describe, expect, it } from 'vitest'
import { domainError } from '@/domain/shared/DomainError'
import { normalizeText } from '@/domain/shared/normalizeText'
import { err, ok } from '@/domain/shared/Result'

describe('Result', () => {
  it('ok wraps a value', () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 })
  })

  it('err wraps an error', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' })
  })
})

describe('domainError', () => {
  it('builds an error without details', () => {
    expect(domainError('date.invalidFormat')).toEqual({ code: 'date.invalidFormat' })
  })

  it('includes details when provided', () => {
    expect(domainError('money.invalidAmount', { value: 'abc' })).toEqual({
      code: 'money.invalidAmount',
      details: { value: 'abc' },
    })
  })
})

describe('normalizeText', () => {
  it.each([
    ['  Café   Central ', 'CAFE CENTRAL'],
    ['ÑOÑO', 'NONO'],
    ['compra\ttarj\n1234', 'COMPRA TARJ 1234'],
    ['', ''],
    ['   ', ''],
    ['Straße', 'STRASSE'],
    [' NBSP TEXT', 'NBSP TEXT'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeText(input)).toBe(expected)
  })

  it('is idempotent', () => {
    const once = normalizeText('Pagó  en CAFÉ')
    expect(normalizeText(once)).toBe(once)
  })

  it('keeps emojis and symbols untouched', () => {
    expect(normalizeText('pizza 🍕 ¡hola!')).toBe('PIZZA 🍕 ¡HOLA!')
  })
})
