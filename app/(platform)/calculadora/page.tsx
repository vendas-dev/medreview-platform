import { ModuleFrame } from '@/components/modules/ModuleFrame'

export default function CalculadoraPage() {
  return (
    <div className="h-[calc(100vh-56px)] lg:h-screen flex flex-col">
      <ModuleFrame
        url="https://calculadora-medreview.lovable.app"
        title="Calculadora Comercial"
      />
    </div>
  )
}
