import { LoginForm } from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>
}) {
  const params = await searchParams
  const isInvalid = params.error === 'invalid_credentials'
  const isDeactivated = params.reason === 'deactivated'

  return <LoginForm isInvalid={isInvalid} isDeactivated={isDeactivated} />
}
