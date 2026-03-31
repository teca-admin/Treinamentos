import React, { useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { User } from "../types";

export const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      onLogin(data.user);
    } else {
      setError(data.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-wfs-bg">
      <img 
        src="https://lh3.googleusercontent.com/d/1sNzDKhdh2zH8d8DoyqIjx8l5LzBEXN5g" 
        alt="WFS Logo" 
        className="absolute top-6 left-6 h-28 object-contain"
      />
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-wfs-surface p-8 max-w-sm w-full border border-wfs-border shadow-md rounded-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-xl font-medium text-wfs-text">Acesso Administrativo</h1>
          <p className="text-wfs-muted text-sm mt-1">Insira suas credenciais</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-wfs-muted mb-1  tracking-wider">UsuÃ¡rio</label>
            <input 
              type="text" 
              className="input-field" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-wfs-muted mb-1  tracking-wider">Senha</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="input-field pr-10" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-wfs-hint hover:text-wfs-muted transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-wfs-danger bg-wfs-accent-light px-3 py-2 text-xs font-medium rounded-sm border border-wfs-danger/20">{error}</p>}
          <button type="submit" className="btn-primary w-full mt-2">
            Entrar no Sistema
          </button>
        </form>
        <div className="mt-6 text-center text-[10px] text-wfs-hint  font-mono tracking-widest border-t border-wfs-border pt-4">
          Plataforma de Treinamentos WFS
        </div>
      </motion.div>
    </div>
  );
};

