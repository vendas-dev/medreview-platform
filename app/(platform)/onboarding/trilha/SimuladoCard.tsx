'use client'
import Link from 'next/link'
import { Trophy, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Attempt {
  simulado_numero: number; score: number; passed: boolean
  correct_answers: number; wrong_answers: number; total_questions: number
}

interface Props {
  attempts: Attempt[]
}

export function SimuladoCard({ attempts }: Props) {
  const attempt1 = attempts.find(a => a.simulado_numero === 1)
  const attempt2 = attempts.find(a => a.simulado_numero === 2)
  const passed   = attempt1?.passed || attempt2?.passed

  // Determinar estado
  let state: 'pending1' | 'pending2' | 'passed' | 'failed'
  if (!attempt1)                           state = 'pending1'
  else if (!attempt1.passed && !attempt2)  state = 'pending2'
  else if (passed)                         state = 'passed'
  else                                     state = 'failed'

  const configs = {
    pending1: {
      icon: '📝', bg: 'linear-gradient(135deg,#312e81,#4f46e5)',
      title: 'Simulado Final disponível!',
      sub: 'Você concluiu toda a trilha. Agora é hora do simulado final.',
      cta: 'Iniciar Simulado 1', ctaHref: '/onboarding/simulado',
      badge: '1ª Tentativa',
    },
    pending2: {
      icon: '🔄', bg: 'linear-gradient(135deg,#7c2d12,#ea580c)',
      title: 'Simulado 2 disponível',
      sub: `Você obteve ${attempt1?.score}% no primeiro simulado. Tente o segundo!`,
      cta: 'Iniciar Simulado 2', ctaHref: '/onboarding/simulado',
      badge: '2ª Tentativa',
    },
    passed: {
      icon: '🏆', bg: 'linear-gradient(135deg,#064e3b,#059669)',
      title: 'Aprovado no Simulado Final!',
      sub: `Nota: ${(attempt2 ?? attempt1)?.score}% — Parabéns pela conclusão completa!`,
      cta: 'Ver resultado', ctaHref: '/onboarding/simulado',
      badge: 'Concluído',
    },
    failed: {
      icon: '😔', bg: 'linear-gradient(135deg,#450a0a,#dc2626)',
      title: 'Simulados realizados',
      sub: 'Você realizou os dois simulados. Fale com seu gestor sobre os próximos passos.',
      cta: 'Ver detalhes', ctaHref: '/onboarding/simulado',
      badge: 'Finalizado',
    },
  }

  const cfg = configs[state]

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,#6366f1,transparent)', marginBottom: 24, opacity: .4 }}/>

      <Link href={cfg.ctaHref} style={{ display:'block', textDecoration:'none' }}>
        <div style={{ background: cfg.bg, borderRadius: 18, padding: '22px 24px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.2)', cursor: 'pointer', transition: 'transform .2s, box-shadow .2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 12px 40px rgba(0,0,0,.3)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='none'; (e.currentTarget as HTMLElement).style.boxShadow='0 8px 32px rgba(0,0,0,.2)' }}>

          {/* Decoração */}
          <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.06)' }}/>
          <div style={{ position:'absolute', bottom:-30, right:60, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.04)' }}/>

          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:44, flexShrink:0, filter:'drop-shadow(0 2px 8px rgba(0,0,0,.3))' }}>{cfg.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', padding:'2px 10px', borderRadius:999, background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.2)' }}>
                  {cfg.badge}
                </span>
              </div>
              <h3 style={{ fontSize:17, fontWeight:900, margin:'0 0 4px', letterSpacing:'-.01em' }}>{cfg.title}</h3>
              <p style={{ fontSize:12, color:'rgba(255,255,255,.75)', margin:0 }}>{cfg.sub}</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.2)', borderRadius:10, padding:'8px 14px', flexShrink:0, backdropFilter:'blur(8px)' }}>
              <span style={{ fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{cfg.cta}</span>
              <ChevronRight size={14}/>
            </div>
          </div>

          {/* Resultado dos attempts se existirem */}
          {(attempt1 || attempt2) && (
            <div style={{ position:'relative', zIndex:1, display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
              {attempt1 && (
                <div style={{ background:'rgba(0,0,0,.2)', borderRadius:9, padding:'6px 12px', display:'flex', alignItems:'center', gap:8 }}>
                  {attempt1.passed ? <CheckCircle size={13}/> : <XCircle size={13}/>}
                  <span style={{ fontSize:11, fontWeight:700 }}>Sim 1: {attempt1.score}% — {attempt1.correct_answers}/{attempt1.total_questions}</span>
                </div>
              )}
              {attempt2 && (
                <div style={{ background:'rgba(0,0,0,.2)', borderRadius:9, padding:'6px 12px', display:'flex', alignItems:'center', gap:8 }}>
                  {attempt2.passed ? <CheckCircle size={13}/> : <XCircle size={13}/>}
                  <span style={{ fontSize:11, fontWeight:700 }}>Sim 2: {attempt2.score}% — {attempt2.correct_answers}/{attempt2.total_questions}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
