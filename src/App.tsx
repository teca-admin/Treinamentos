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
    <div className="min-h-screen flex flex-col font-sans bg-wfs-bg text-wfs-text">
      {/* Topbar WFS (64px) */}
      <header className="h-16 bg-wfs-surface flex items-center justify-between px-6 sticky top-0 z-50 border-b border-wfs-border">
        <div className="flex items-center gap-4">
          <img 
            src="https://lh3.googleusercontent.com/d/1sNzDKhdh2zH8d8DoyqIjx8l5LzBEXN5g" 
            alt="WFS Logo" 
            className="h-12 object-contain"
          />
          <span className="bg-wfs-accent-light text-wfs-accent-dark text-[10px] font-medium  tracking-widest px-3 py-1 rounded-sm border border-wfs-accent/20">
            Treinamentos
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-wfs-muted hidden md:block">
            {user.username}
          </span>
          <button
            onClick={() => setUser(null)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-wfs-muted hover:text-wfs-danger hover:bg-red-50 rounded-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      {/* Main Content (p-4 mobile, p-8 desktop, max-w-7xl) */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
          <TreinamentoModule user={user} currentContract={currentContract} />
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 bg-wfs-surface border-t border-wfs-border flex items-center justify-between px-6 text-[11px] font-medium font-mono text-wfs-hint">
        <div>WFS v1.0.0 â€¢ Plataforma de Treinamentos</div>
        <div className="flex gap-4">
          <button onClick={() => setIsPortal(true)} className="hover:text-wfs-accent transition-colors font-sans  font-medium text-[10px]">
            Acessar Portal do Colaborador
          </button>
        </div>
      </footer>
    </div>
  );
}

