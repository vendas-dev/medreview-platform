'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MedLogoSVG } from '@/components/MedLogo'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 46, padding: '0 16px', borderRadius: 12,
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#f1f5f9', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      await supabase.auth.signOut()
      setTimeout(() => router.push('/login'), 2200)
    } catch (err: any) {
      setError(err?.message === 'Auth session missing!'
        ? 'Esse link expirou ou já foi usado. Solicite um novo em "Esqueci minha senha".'
        : (err?.message ?? 'Não foi possível redefinir a senha.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>

      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/login-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(10,14,26,0.75) 0%, rgba(8,12,22,0.55) 50%, rgba(10,14,26,0.75) 100%)',
        backdropFilter: 'blur(1px)',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}>
            <MedLogoSVG size={52} color="#e2e8f0" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', margin: '0 0 6px', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>Med-Review</h1>
          <p style={{ fontSize: 14, color: 'rgba(241,245,249,0.6)', margin: 0 }}>Plataforma Operacional</p>
        </div>

        <div style={{
          background: 'rgba(15,20,40,0.7)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24, padding: '32px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          {!done ? (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>Defina sua nova senha</h2>
              <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)', margin: '0 0 28px' }}>Escolha uma senha com pelo menos 8 caracteres</p>

              {error && (
                <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 20 }}>
                  <span style={{ color: '#fca5a5', fontSize: 13, fontWeight: 500 }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.8)' }}>Nova senha</label>
                  <input type="password" required autoComplete="new-password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.boxShadow = 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.8)' }}>Confirmar nova senha</label>
                  <input type="password" required autoComplete="new-password" placeholder="••••••••"
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.boxShadow = 'none' }} />
                </div>
                <button type="submit" disabled={loading}
                  style={{
                    height: 48, borderRadius: 13, fontSize: 15, fontWeight: 700,
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    marginTop: 4, transition: 'all 0.18s',
                    background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 20px rgba(99,102,241,0.4), 0 1px 4px rgba(0,0,0,0.3)',
                    letterSpacing: '-0.01em',
                  }}>
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>Senha redefinida!</h2>
              <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.55)', margin: 0 }}>Redirecionando para o login...</p>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  )
}
