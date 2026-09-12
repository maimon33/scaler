import { Dashboard } from './components/Dashboard'
import { Footer } from './components/Footer'
import { Nav } from './components/Nav'
import { useMetricsSimulation } from './hooks/useMetricsSimulation'
import { ScalerProvider } from './hooks/useScalerStore'

function Demo() {
  useMetricsSimulation()

  return (
    <>
      <Nav />
      <Dashboard />
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <ScalerProvider>
      <Demo />
    </ScalerProvider>
  )
}
