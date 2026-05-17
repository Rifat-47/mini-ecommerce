import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import ErrorMessage from '@/components/shared/ErrorMessage'
import api from '@/api/axios'

export default function ResetPasswordPage() {
  const { uid, token } = useParams()
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  function validate() {
    const errors = {}
    if (!newPassword) errors.new_password = 'New password is required.'
    else if (newPassword.length < 8) errors.new_password = 'Password must be at least 8 characters.'
    else if (newPassword.length > 20) errors.new_password = 'Password must be at most 20 characters.'
    if (!confirmPassword) errors.confirm_password = 'Please confirm your password.'
    else if (newPassword !== confirmPassword) errors.confirm_password = 'Passwords do not match.'
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const errors = validate()
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    setIsLoading(true)
    try {
      await api.post(`/auth/reset-password/${uid}/${token}/`, { new_password: newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data || { error: 'Reset link is invalid or has expired.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center text-center py-10 gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-success/10">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-1">Password reset!</h2>
            <p className="text-sm text-muted-foreground">
              Your password has been updated. Redirecting to login...
            </p>
          </div>
          <Link to="/login">
            <Button className="mt-2">Go to Login</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">Reset password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <ErrorMessage error={error} className="mb-4" />

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new_password">New password <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showPassword ? 'text' : 'password'}
                placeholder="8–20 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setFieldErrors((f) => ({ ...f, new_password: '' })) }}
                autoFocus
                autoComplete="new-password"
                maxLength={20}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.new_password && <p className="text-sm text-destructive">{fieldErrors.new_password}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm password <span className="text-destructive">*</span></Label>
            <Input
              id="confirm_password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((f) => ({ ...f, confirm_password: '' })) }}
              autoComplete="new-password"
              maxLength={20}
            />
            {fieldErrors.confirm_password && <p className="text-sm text-destructive">{fieldErrors.confirm_password}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link to="/login" className="text-primary font-medium hover:underline">
          Back to login
        </Link>
      </CardFooter>
    </Card>
  )
}
