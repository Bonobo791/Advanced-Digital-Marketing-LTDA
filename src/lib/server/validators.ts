/**
 * Server-side input validators: email format and Brazilian CPF / CNPJ
 * checksums. Used before persisting an order and before calling Mercado Pago.
 */

export type DocumentType = 'CPF' | 'CNPJ'

export function stripDigits(value: string): string {
  return value.replace(/\D/g, '')
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

function checkDigit(digits: string, weights: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i++) {
    sum += Number(digits[i]) * weights[i]
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

/** Validates the CPF check digits (11 digits, weights 10..2 then 11..2). */
export function isValidCpf(input: string): boolean {
  const digits = stripDigits(input)
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false

  const firstWeights = [10, 9, 8, 7, 6, 5, 4, 3, 2]
  const secondWeights = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
  return (
    checkDigit(digits, firstWeights) === Number(digits[9]) &&
    checkDigit(digits, secondWeights) === Number(digits[10])
  )
}

/** Validates the CNPJ check digits (14 digits, weights 5..2 then 6..2). */
export function isValidCnpj(input: string): boolean {
  const digits = stripDigits(input)
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  return (
    checkDigit(digits, firstWeights) === Number(digits[12]) &&
    checkDigit(digits, secondWeights) === Number(digits[13])
  )
}

export function isValidDocument(type: DocumentType, number: string): boolean {
  return type === 'CPF' ? isValidCpf(number) : isValidCnpj(number)
}
