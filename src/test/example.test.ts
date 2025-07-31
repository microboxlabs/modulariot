import { describe, it, expect } from 'vitest'

describe('Example Test Suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle string operations', () => {
    const message = 'Hello, Vitest!'
    expect(message).toContain('Vitest')
    expect(message.length).toBeGreaterThan(0)
  })

  it('should work with arrays', () => {
    const numbers = [1, 2, 3, 4, 5]
    expect(numbers).toHaveLength(5)
    expect(numbers).toContain(3)
    expect(numbers.filter(n => n > 3)).toEqual([4, 5])
  })
}) 