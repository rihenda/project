import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Fournisseurs from './pages/Fournisseurs'
import Factures from './pages/Factures'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/fournisseurs" replace />} />
            <Route path="/fournisseurs" element={<Fournisseurs />} />
            <Route path="/factures" element={<Factures />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
