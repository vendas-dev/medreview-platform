import { LoginForm } from './LoginForm'

export default function LoginPage({ searchParams }: { searchParams: { error?: string; reason?: string } }) {
  const isInvalid = searchParams.error === 'invalid_credentials'
  const isDeactivated = searchParams.reason === 'deactivated'
  return <LoginForm isInvalid={isInvalid} isDeactivated={isDeactivated} />
}
