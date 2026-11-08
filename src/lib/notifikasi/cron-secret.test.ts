import { describe, expect, it } from 'vitest'
import { bearerCronCocok } from './cron-secret'

const SECRET = 'rahasia-uji'

describe('bearerCronCocok', () => {
  it('menerima Bearer yang cocok', () => {
    expect(bearerCronCocok(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it('tidak peka huruf besar/kecil pada skema', () => {
    expect(bearerCronCocok(`bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it('menolak secret salah', () => {
    expect(bearerCronCocok('Bearer salah', SECRET)).toBe(false)
  })

  it('menolak header tanpa skema Bearer', () => {
    expect(bearerCronCocok(SECRET, SECRET)).toBe(false)
  })

  it('menolak header kosong', () => {
    expect(bearerCronCocok(null, SECRET)).toBe(false)
    expect(bearerCronCocok('Bearer   ', SECRET)).toBe(false)
  })

  it('menolak saat CRON_SECRET tidak diisi', () => {
    expect(bearerCronCocok(`Bearer ${SECRET}`, undefined)).toBe(false)
    expect(bearerCronCocok(`Bearer ${SECRET}`, '')).toBe(false)
  })
})
