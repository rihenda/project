import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Fournisseurs from './pages/Fournisseurs'
import Factures from './pages/Factures'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#F1F5F9]">
        <Sidebar />
        <main className="flex-1 ml-[224px] min-h-screen">
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
