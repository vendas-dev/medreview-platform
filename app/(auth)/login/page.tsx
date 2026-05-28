import { login } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; reason?: string }
}) {
  const isInvalidCredentials = searchParams.error === 'invalid_credentials'
  const isDeactivated = searchParams.reason === 'deactivated'

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground">MedReview</h1>
        <p className="text-sm text-muted-foreground mt-1">Plataforma Operacional</p>
      </div>

      {/* Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-foreground">Entrar na plataforma</h2>
          <p className="text-sm text-muted-foreground mt-1">Use suas credenciais de acesso</p>
        </div>

        {/* Erros */}
        {isInvalidCredentials && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">Email ou senha incorretos.</p>
          </div>
        )}
        {isDeactivated && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">Sua conta foi desativada. Fale com o administrador.</p>
          </div>
        )}

        <form action={login} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            Entrar
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Problemas de acesso? Fale com o administrador.
      </p>
    </div>
  )
}
