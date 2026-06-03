// Logo SVG fiel ao logo real da MedReview
// M estilizado com nós nas intersecções e dois pontos flutuantes laterais

export function MedLogoSVG({ size = 24, color = '#3d3d3d' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Traço vertical central */}
      <line x1="50" y1="8" x2="50" y2="92" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      {/* Braço esquerdo superior: centro → esquerda-cima */}
      <line x1="50" y1="50" x2="22" y2="32" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      {/* Braço direito superior: centro → direita-cima */}
      <line x1="50" y1="50" x2="78" y2="32" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      {/* Braço esquerdo inferior: esquerda-cima → esquerda-baixo */}
      <line x1="22" y1="32" x2="22" y2="68" stroke={color} strokeWidth="5" strokeLinecap="round"/>
      {/* Braço direito inferior: direita-cima → direita-baixo */}
      <line x1="78" y1="32" x2="78" y2="68" stroke={color} strokeWidth="5" strokeLinecap="round"/>
      {/* Nós: pontos nas extremidades e intersecções */}
      <circle cx="50" cy="8"  r="7" fill={color}/>  {/* topo */}
      <circle cx="50" cy="92" r="7" fill={color}/>  {/* base */}
      <circle cx="50" cy="50" r="7" fill={color}/>  {/* centro */}
      <circle cx="22" cy="32" r="6.5" fill={color}/> {/* esq-cima */}
      <circle cx="78" cy="32" r="6.5" fill={color}/> {/* dir-cima */}
      <circle cx="22" cy="68" r="6.5" fill={color}/> {/* esq-baixo */}
      <circle cx="78" cy="68" r="6.5" fill={color}/> {/* dir-baixo */}
      {/* Pontos flutuantes laterais */}
      <circle cx="5"  cy="50" r="5.5" fill={color}/> {/* ponto esq */}
      <circle cx="95" cy="50" r="5.5" fill={color}/> {/* ponto dir */}
    </svg>
  )
}

export function LogoMark({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: dark ? '#1a1a1a' : 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.12)',
    }}>
      <MedLogoSVG size={size * 0.72} color={dark ? 'white' : '#3d3d3d'} />
    </div>
  )
}
