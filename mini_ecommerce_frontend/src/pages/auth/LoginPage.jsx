import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import ErrorMessage from '@/components/shared/ErrorMessage'
import useAuthStore from '@/store/authStore'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const { login, confirmTwoFA, isLoading } = useAuthStore()
  const syncCart = useCartStore((s) => s.syncOnLogin)
  const syncWishlist = useWishlistStore((s) => s.syncOnLogin)

  const [step, setStep] = useState('credentials') // 'credentials' | '2fa'
  const [twoFaToken, setTwoFaToken] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  function validateCredentials() {
    const errors = {}
    if (!email.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'
    if (!password) errors.password = 'Password is required.'
    return errors
  }

  async function handleCredentialsSubmit(e) {
    e.preventDefault()
    setError(null)
    const errors = validateCredentials()
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    try {
      const result = await login(email, password)
      if (result.requires_2fa) {
        setTwoFaToken(result.two_fa_token)
        setStep('2fa')
      } else {
        await postLoginSync()
      }
    } catch (err) {
      setError(err.response?.data || { error: 'Login failed. Please try again.' })
    }
  }

  async function handleTwoFaSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await confirmTwoFA(twoFaToken, twoFaCode)
      await postLoginSync()
    } catch (err) {
      setError(err.response?.data || { error: '2FA verification failed.' })
    }
  }

  async function postLoginSync() {
    await Promise.allSettled([syncCart(), syncWishlist()])
    navigate(from, { replace: true })
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">
          {step === '2fa' ? 'Two-Factor Authentication' : 'Welcome back'}
        </CardTitle>
        <CardDescription>
          {step === '2fa'
            ? 'Enter the 6-digit code from your authenticator app'
            : 'Sign in to your account'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <ErrorMessage error={error} className="mb-4" />

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: '' })) }}
                autoComplete="email"
                autoFocus
              />
              {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: '' })) }}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-sm text-destructive">{fieldErrors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        ) : (
          <form onSubmit={handleTwoFaSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Authenticator Code <span className="text-destructive">*</span></Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="text-center text-2xl tracking-widest font-mono"
              />
              <p className="text-xs text-muted-foreground text-center">
                Code expires in 5 minutes
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || twoFaCode.length !== 6}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={() => { setStep('credentials'); setError(null); setTwoFaCode('') }}
            >
              ← Back to login
            </Button>
          </form>
        )}
      </CardContent>

      {step === 'credentials' && (
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Don't have an account?&nbsp;
          <Link to="/register" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </CardFooter>
      )}
    </Card>
  )
}
