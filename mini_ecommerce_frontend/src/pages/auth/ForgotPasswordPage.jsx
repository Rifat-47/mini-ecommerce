import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import ErrorMessage from '@/components/shared/ErrorMessage'
import api from '@/api/axios'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  function validate() {
    const errors = {}
    if (!email.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'
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
      await api.post('/auth/forgot-password/', { email })
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data || { error: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center text-center py-10 gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-success/10">
            <MailCheck className="h-7 w-7 text-success" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-1">Check your email</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              you'll receive a password reset link shortly. The link expires in 24 hours.
            </p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="mt-2">Back to login</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">Forgot password?</CardTitle>
        <CardDescription>
          Enter your email and we'll send you a reset link
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <ErrorMessage error={error} className="mb-4" />

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: '' })) }}
              autoFocus
              autoComplete="email"
            />
            {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        Remember your password?&nbsp;
        <Link to="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
