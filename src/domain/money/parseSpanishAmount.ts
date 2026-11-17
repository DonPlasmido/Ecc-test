import { Money } from '@/domain/money/Money'
import { domainError, type DomainError } from '@/domain/shared/DomainError'
import { err, type Result } from '@/domain/shared/Result'

const MAX_REPORTED_LENGTH = 50
const CURRENCY_MARKS = /€|\bEUR\b/giu
const MINUS_SIGNS = /[−‒–]/gu
/** Entero con miles opcionales (1.234.567) o sin ellos. */
const INTEGER_PART = /^(?:\d{1,3}(?:\.\d{3})+|\d+)$/u
const ONE_OR_TWO_DIGITS = /^\d{1,2}$/u

interface SignedBody {
  readonly negative: boolean
  readonly body: string
}

function reported(text: string): string {
  return text.slice(0, MAX_REPORTED_LENGTH)
}

/** Separa el signo (prefijo, sufijo o paréntesis); `null` si hay signos contradictorios. */
function splitSign(cleaned: string): SignedBody | null {
  let body = cleaned
  let negative = false
  let signs = 0
  if (body.startsWith('(') && body.endsWith(')')) {
    body = body.slice(1, -1).trim()
    negative = true
    signs += 1
  }
  const lead = body[0]
  if (lead === '-' || lead === '+') {
    negative = negative || lead === '-'
    body = body.slice(1).trim()
    signs += 1
  }
  const tail = body[body.length - 1]
  if (tail === '-' || tail === '+') {
    negative = negative || tail === '-'
    body = body.slice(0, -1).trim()
    signs += 1
  }
  return signs > 1 ? null : { negative, body }
}

/** Devuelve [parteEntera, decimales] o `null` si el formato no es válido. */
function splitDigits(body: string): readonly [string, string] | null {
  const commaParts = body.split(',')
  if (commaParts.length > 2) return null
  if (commaParts.length === 2) {
    const [integer = '', decimals = ''] = commaParts
    const integerOk = integer === '' || INTEGER_PART.test(integer)
    return integerOk && ONE_OR_TWO_DIGITS.test(decimals) ? [integer, decimals] : null
  }
  const dotParts = body.split('.')
  if (dotParts.length === 2) {
    const [integer = '', decimals = ''] = dotParts
    // Un único punto con 1-2 decimales es decimal; con 3 dígitos es separador de miles.
    if (ONE_OR_TWO_DIGITS.test(decimals) && /^\d+$/u.test(integer)) return [integer, decimals]
  }
  return INTEGER_PART.test(body) ? [body, ''] : null
}

/** Interpreta importes en formato español ("1.234,56", "-12,30", "12,30-", "(1.234,56)") sin `parseFloat`. */
export function parseSpanishAmount(text: string): Result<Money, DomainError> {
  const cleaned = text.replace(CURRENCY_MARKS, ' ').replace(MINUS_SIGNS, '-').trim()
  const signed = splitSign(cleaned)
  const digits = signed === null ? null : splitDigits(signed.body)
  if (signed === null || digits === null) {
    return err(domainError('money.invalidAmount', { value: reported(text) }))
  }
  const [integer, decimals] = digits
  const magnitude = Number(`${integer.replaceAll('.', '') || '0'}${decimals.padEnd(2, '0')}`)
  const result = Money.ofCents(signed.negative ? -magnitude : magnitude)
  if (!result.ok && result.error.code === 'money.notInteger') {
    return err(domainError('money.outOfRange', { value: reported(text) }))
  }
  return result
}
