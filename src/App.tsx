import React, { useState } from "react";
import { LogOut } from "lucide-react";

// Components
import { Login } from "./components/Login";
import { TreinamentoModule } from "./components/TreinamentoModule";
import { EmployeePortal } from "./components/EmployeePortal";

// Types
import { User } from "./types";
import { useContract } from "./contexts/ContractContext";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isPortal, setIsPortal] = useState(window.location.search.includes("portal=true"));
  const { currentContract } = useContract();

  if (isPortal) return <EmployeePortal onExit={() => {
    setIsPortal(false);
    window.history.pushState({}, '', window.location.pathname);
  }} />;

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white text-slate-800 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-nexus-primary rounded flex items-center justify-center font-black text-xl text-white">N</div>
          <h1 className="text-xl font-bold tracking-tighter text-nexus-sidebar">NEXUS</h1>
          <span className="ml-4 bg-nexus-primary/10 text-nexus-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-nexus-primary/20">
            Treinamentos
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden md:block">
            {user.username}
          </span>
          <button
            onClick={() => setUser(null)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-nexus-bg overflow-y-auto">
        <TreinamentoModule user={user} currentContract={currentContract} />
      </main>

      {/* Footer */}
      <footer className="h-10 bg-white border-t flex items-center justify-between px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <div>NEXUS v1.0.0 • Plataforma de Treinamentos</div>
        <div className="flex gap-4">
          <button onClick={() => setIsPortal(true)} className="hover:text-nexus-primary transition-colors">
            Acessar Portal do Colaborador
          </button>
          <span>Suporte: 0800-NEXUS</span>
        </div>
      </footer>
    </div>
  );
}
