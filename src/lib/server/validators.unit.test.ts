import { describe, expect, it } from 'vitest'
import { isValidCnpj, isValidCpf, isValidDocument, isValidEmail, stripDigits } from './validators'

describe('email validation', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('contact@advanceddigitalmarketingltda.com')).toBe(true)
    expect(isValidEmail('a.b+c@example.co.uk')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
  })
})

describe('CPF validation', () => {
  it('accepts known-valid CPFs with any formatting', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('111.444.777-35')).toBe(true)
  })

  it('rejects invalid, repeated-digit and wrong-length CPFs', () => {
    expect(isValidCpf('123.456.789-00')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('529.982.247-26')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })
})

describe('CNPJ validation', () => {
  it('accepts a known-valid CNPJ with formatting', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000181')).toBe(true)
  })

  it('rejects invalid, repeated-digit and wrong-length CNPJs', () => {
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false)
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false)
    expect(isValidCnpj('1122233300018')).toBe(false)
    expect(isValidCnpj('')).toBe(false)
  })
})

describe('document dispatch', () => {
  it('routes to the correct checksum', () => {
    expect(isValidDocument('CPF', '529.982.247-25')).toBe(true)
    expect(isValidDocument('CNPJ', '11.222.333/0001-81')).toBe(true)
    expect(isValidDocument('CPF', '11.222.333/0001-81')).toBe(false)
  })
})

describe('stripDigits', () => {
  it('keeps only digits', () => {
    expect(stripDigits('529.982.247-25')).toBe('52998224725')
  })
})
