import Navbar from './components/Navbar'
import './index.css'

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <Navbar />

      {/* Main content area — features will go here */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-sm">Outil Finance HostnFly</p>
        </div>
      </main>
    </div>
  )
}

export default App
