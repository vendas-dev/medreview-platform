'use client'
import { saveSettings } from '../actions'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.15s',
}

export function ConfigForm({ settings: s }: { settings: any }) {
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>Configuração do Copilot</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Configure o comportamento da IA de onboarding.</p>
      </div>

      <form action={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Boas-vindas */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>Mensagem de boas-vindas</h2>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>Enviada automaticamente no primeiro acesso.</p>
          <textarea name="welcome_message" defaultValue={s?.welcome_message} rows={4}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        {/* Tom */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>Tom do Copilot</h2>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>Define o estilo de comunicação da IA.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { value: 'didatico',     label: 'Didático e acolhedor',     desc: 'Paciente e explicativo' },
              { value: 'objetivo',     label: 'Objetivo e direto',         desc: 'Respostas concisas' },
              { value: 'descontraido', label: 'Descontraído e motivador',  desc: 'Tom informal e amigável' },
              { value: 'formal',       label: 'Formal e profissional',     desc: 'Linguagem técnica' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--border)', cursor: 'pointer' }}>
                <input type="radio" name="tone" value={opt.value} defaultChecked={s?.tone === opt.value} style={{ marginTop: 2, accentColor: 'var(--foreground)' }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px' }}>{opt.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Modo trilha */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>Modo da Trilha</h2>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>Define se o usuário acessa etapas livremente ou em sequência.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { value: 'livre',       label: 'Modo Livre',       desc: 'Usuário acessa qualquer etapa' },
              { value: 'sequencial',  label: 'Modo Sequencial',  desc: 'Precisa concluir a anterior' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--border)', cursor: 'pointer' }}>
                <input type="radio" name="track_mode" value={opt.value} defaultChecked={s?.track_mode === opt.value} style={{ marginTop: 2, accentColor: 'var(--foreground)' }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px' }}>{opt.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Instruções extras */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>Instruções Extras</h2>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>Regras e contexto adicional para a IA.</p>
          <textarea name="extra_instructions" defaultValue={s?.extra_instructions ?? ''} rows={6}
            placeholder="Ex: Sempre que mencionar produtos, reforce o diferencial da MedReview..."
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        <button type="submit"
          style={{ height: 44, borderRadius: 10, background: 'var(--foreground)', color: 'var(--card)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          Salvar configurações
        </button>
      </form>
    </div>
  )
}
