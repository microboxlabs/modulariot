/\* import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the auth service - you would import the actual service here
// import { authService } from '@/features/auth/services/auth.service'

// Example auth service for testing
const authService = {
login: vi.fn(),
logout: vi.fn(),
isAuthenticated: vi.fn(),
getUser: vi.fn(),
}

describe('AuthService', () => {
beforeEach(() => {
vi.clearAllMocks()
})

describe('login', () => {
it('should call login with correct credentials', async () => {
const credentials = {
email: 'test@example.com',
password: 'password123'
}

      authService.login.mockResolvedValue({ success: true, user: { id: 1, email: credentials.email } })

      const result = await authService.login(credentials)

      expect(authService.login).toHaveBeenCalledWith(credentials)
      expect(result).toEqual({ success: true, user: { id: 1, email: credentials.email } })
    })

    it('should handle login failure', async () => {
      const credentials = {
        email: 'invalid@example.com',
        password: 'wrongpassword'
      }

      authService.login.mockRejectedValue(new Error('Invalid credentials'))

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials')
      expect(authService.login).toHaveBeenCalledWith(credentials)
    })

})

describe('logout', () => {
it('should call logout successfully', async () => {
authService.logout.mockResolvedValue({ success: true })

      const result = await authService.logout()

      expect(authService.logout).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

})

describe('isAuthenticated', () => {
it('should return true when user is authenticated', () => {
authService.isAuthenticated.mockReturnValue(true)

      const result = authService.isAuthenticated()

      expect(authService.isAuthenticated).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should return false when user is not authenticated', () => {
      authService.isAuthenticated.mockReturnValue(false)

      const result = authService.isAuthenticated()

      expect(authService.isAuthenticated).toHaveBeenCalled()
      expect(result).toBe(false)
    })

})

describe('getUser', () => {
it('should return user data when authenticated', async () => {
const mockUser = {
id: 1,
email: 'test@example.com',
name: 'Test User'
}

      authService.getUser.mockResolvedValue(mockUser)

      const result = await authService.getUser()

      expect(authService.getUser).toHaveBeenCalled()
      expect(result).toEqual(mockUser)
    })

    it('should return null when not authenticated', async () => {
      authService.getUser.mockResolvedValue(null)

      const result = await authService.getUser()

      expect(authService.getUser).toHaveBeenCalled()
      expect(result).toBeNull()
    })

})
}) \*/
