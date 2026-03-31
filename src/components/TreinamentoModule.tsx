import React, { useState, useEffect } from "react";
import { Plus, Video, ClipboardList, Trash2, Save, CheckCircle, X, Image as ImageIcon, Link as LinkIcon, Copy, Search, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Contract } from "../types";

import { getSupabaseClient } from "../lib/supabase";

export const TreinamentoModule = ({ user, currentContract }: { user: User, currentContract: Contract }) => {
  const [tab, setTab] = useState("cursos");
  const [supabaseClient, setSupabaseClient] = useState<any>(null);

  useEffect(() => {
    // Initialize Supabase Client for direct storage upload
    getSupabaseClient().then(setSupabaseClient);
  }, []);
  const [cursos, setCursos] = useState<any[]>([]);
  const [resultados, setResultados] = useState<any[]>([]);
  const [filterMatricula, setFilterMatricula] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [createdCursoId, setCreatedCursoId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isManageLoading, setIsManageLoading] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({ 
    nome: "", 
    data_inicio: new Date().toISOString().split('T')[0], 
    data_fim: "",
    capa_url: ""
  });

  // Content states
  const [videoData, setVideoData] = useState({ titulo: "", url_video: "" });
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [conteudos, setConteudos] = useState<any[]>([]);
  const [avaliacaoData, setAvaliacaoData] = useState({ nota_minima: 70, tentativas_maximas: 3 });
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [novaQuestao, setNovaQuestao] = useState({ enunciado: "", opcoes: [
    { texto: "", correta: true },
    { texto: "", correta: false },
    { texto: "", correta: false },
    { texto: "", correta: false }
  ]});

  const load = () => fetch(`/api/cursos?contrato=${currentContract}`).then(res => res.json()).then(setCursos);
  const loadResultados = () => fetch(`/api/treinamentos/resultados?contrato=${currentContract}`).then(res => res.json()).then(setResultados);
  
  useEffect(() => { 
    load(); 
    loadResultados();
  }, [currentContract]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, capa_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = createdCursoId ? "PUT" : "POST";
    const url = createdCursoId ? `/api/cursos/${createdCursoId}?contrato=${currentContract}` : `/api/cursos?contrato=${currentContract}`;
    
    // Optimistic update
    const tempId = createdCursoId || Date.now();
    const newCurso = {
      ...formData,
      id: tempId,
      descricao: ""
    } as any;
    
    if (createdCursoId) {
      setCursos(prev => prev.map(c => c.id === createdCursoId ? { ...c, ...newCurso } : c));
    } else {
      setCursos(prev => [newCurso, ...prev]);
    }
    
    if (!createdCursoId) setCreatedCursoId(tempId);
    setStep(2);

    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        descricao: "", 
      }),
    });
    
    if (res.ok) {
      const data = await res.json();
      if (!createdCursoId) {
        setCreatedCursoId(data.id);
        setCursos(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c));
      }
    } else {
      load(); // Revert on error
    }
  };

  const manageContent = async (curso: any) => {
    setIsManageLoading(curso.id);
    try {
      setCreatedCursoId(curso.id);
      setFormData({
        nome: curso.nome,
        data_inicio: curso.data_inicio || new Date().toISOString().split('T')[0],
        data_fim: curso.data_fim || "",
        capa_url: curso.capa_url || ""
      });
      
      const res = await fetch(`/api/cursos/${curso.id}/conteudo?contrato=${currentContract}`);
      const data = await res.json();
      setConteudos(data.conteudos);
      if (data.avaliacao) {
        setAvaliacaoData({
          nota_minima: data.avaliacao.nota_minima,
          tentativas_maximas: data.avaliacao.tentativas_maximas
        });
        setQuestoes(data.questoes);
      } else {
        setAvaliacaoData({ nota_minima: 70, tentativas_maximas: 3 });
        setQuestoes([]);
      }
      
      setStep(1); // Start at step 1 to allow editing basic info, then proceed to step 2
      setShowForm(true);
    } catch (error) {
      alert("Erro ao carregar conteúdo do curso.");
    } finally {
      setIsManageLoading(null);
    }
  };

  const addVideo = async () => {
    if (!videoData.titulo) {
      alert("Por favor, insira um título para o vídeo.");
      return;
    }
    if (!videoData.url_video) {
      alert("Por favor, selecione um arquivo de vídeo.");
      return;
    }
    
    setIsVideoLoading(true);
    try {
      // 1. Check if it's a base64 (new upload) or a URL (existing)
      let finalUrl = videoData.url_video;
      
      if (videoData.url_video.startsWith("data:")) {
        if (!supabaseClient) throw new Error("Supabase client not initialized");
        
        // Convert base64 to Blob
        const res = await fetch(videoData.url_video);
        const blob = await res.blob();
        const fileExt = blob.type.split('/')[1] || 'mp4';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Upload to storage
        let bucketName = 'videos';
        let uploadResult = await supabaseClient.storage.from(bucketName).upload(fileName, blob);
        
        if (uploadResult.error) {
           console.log("Erro ao subir no bucket 'videos', tentando 'treinamentos'...");
           bucketName = 'treinamentos';
           uploadResult = await supabaseClient.storage.from(bucketName).upload(fileName, blob);
        }

        if (uploadResult.error) {
          if (uploadResult.error.message.includes("Bucket not found")) {
            throw new Error("O Bucket 'videos' não existe no Supabase. Por favor, acesse o painel do Supabase > Storage e crie um bucket público chamado 'videos'.");
          }
          throw new Error(`Erro no upload para o Storage: ${uploadResult.error.message}`);
        }
        
        // Get public URL using the confirmed bucket name
        const { data: { publicUrl } } = supabaseClient.storage.from(bucketName).getPublicUrl(uploadResult.data.path);
        finalUrl = publicUrl;
      }

      // 2. Save to database
      const res = await fetch("/api/cursos/conteudo?contrato=" + currentContract, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curso_id: createdCursoId,
          titulo: videoData.titulo,
          url_video: finalUrl,
          ordem: conteudos.length + 1
        }),
      });
      
      if (res.ok) {
        setConteudos([...conteudos, { ...videoData, url_video: finalUrl, id: Date.now() }]);
        setVideoData({ titulo: "", url_video: "" });
      } else {
        const data = await res.json();
        throw new Error(data.message || "Erro ao salvar no banco de dados");
      }
    } catch (error: any) {
      alert(`Erro ao processar vídeo: ${error.message}`);
    } finally {
      setIsVideoLoading(false);
    }
  };

  const deleteVideo = async (id: number) => {
    if (!confirm("Deseja remover este vídeo?")) return;
    const previous = [...conteudos];
    setConteudos(conteudos.filter(c => c.id !== id));
    const res = await fetch(`/api/cursos/conteudo/${id}?contrato=${currentContract}`, { method: "DELETE" });
    if (!res.ok) {
      setConteudos(previous);
    }
  };

  const deleteQuestao = (id: number) => {
    setQuestoes(questoes.filter(q => q.id !== id));
  };

  const addQuestao = () => {
    if (!novaQuestao.enunciado) return;
    setQuestoes([...questoes, { ...novaQuestao, id: Date.now() }]);
    setNovaQuestao({ enunciado: "", opcoes: [
      { texto: "", correta: true },
      { texto: "", correta: false },
      { texto: "", correta: false },
      { texto: "", correta: false }
    ]});
  };

  const saveAvaliacao = async () => {
    if (questoes.length === 0) {
      alert("Adicione pelo menos uma questão à prova.");
      return;
    }
    const res = await fetch("/api/cursos/avaliacao?contrato=" + currentContract, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        curso_id: createdCursoId,
        nota_minima: avaliacaoData.nota_minima,
        tentativas_maximas: avaliacaoData.tentativas_maximas,
        questoes: questoes
      }),
    });
    if (res.ok) {
      setShowSuccess(true);
    } else {
      const data = await res.json();
      alert("Erro ao salvar: " + data.message);
    }
  };

  const closeModal = () => {
    setShowForm(false);
    setShowSuccess(false);
    setStep(1);
    setCreatedCursoId(null);
    setFormData({ 
      nome: "", 
      data_inicio: new Date().toISOString().split('T')[0], 
      data_fim: "", 
      capa_url: "" 
    });
    setConteudos([]);
    setQuestoes([]);
  };

  const portalLink = `${window.location.origin}/?portal=true`;

  const copyLink = () => {
    navigator.clipboard.writeText(portalLink);
    alert("Link copiado para a área de transferência!");
  };

  return (
    <div className="p-6">
      <div className="flex gap-4 border-b mb-6">
        {["cursos", "resultados"].map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)}
            className={`pb-2 px-4 text-xs font-medium  tracking-wider transition-colors ${
              tab === t ? 'border-b-2 border-wfs-accent text-wfs-accent' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "cursos" && (
        <div>
      <div className="bg-white p-4 border-2 border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-medium text-slate-800 tracking-tighter  flex items-center gap-2">
            <Video className="w-5 h-5 text-wfs-accent" />
            Catálogo de Cursos
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1.5 border-2 border-slate-200">
            <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">{portalLink}</span>
            <button onClick={copyLink} className="text-wfs-accent hover:text-red-700 p-1" title="Copiar Link do Portal">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          {(user.role === "Admin" || user.role === "Treinamento") && (
            <button onClick={() => { closeModal(); setShowForm(true); }} className="bg-wfs-accent text-white font-medium  text-xs tracking-widest px-6 py-3 rounded-none hover:bg-wfs-accent/90 transition-all shadow-lg flex items-center gap-2">
              <Plus className="w-4 h-4" /> Criar Curso
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cursos.map(c => (
          <div key={c.id} className="bg-white border-2 border-slate-200 flex flex-col justify-between overflow-hidden p-0">
            <div className="h-32 bg-slate-100 relative overflow-hidden border-b-2 border-slate-200">
              {c.capa_url ? (
                <img src={c.capa_url} alt={c.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="p-4 flex-1">
              <h4 className="font-medium text-slate-800 mb-1">{c.nome}</h4>
              <p className="text-[10px] text-slate-400 font-medium  tracking-widest">
                Disponível: {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString() : '-'} até {c.data_fim ? new Date(c.data_fim).toLocaleDateString() : '-'}
              </p>
            </div>
            <div className="px-4 py-3 border-t-2 border-slate-200 bg-slate-50 flex justify-end">
              <button 
                onClick={() => manageContent(c)}
                disabled={isManageLoading === c.id}
                className="text-wfs-accent text-[10px] font-medium  hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {isManageLoading === c.id && <div className="w-3 h-3 border-2 border-wfs-accent/30 border-t-wfs-accent rounded-full animate-spin" />}
                {isManageLoading === c.id ? "Carregando..." : "Gerenciar Conteúdo"}
              </button>
            </div>
          </div>
        ))}
      </div>
        </div>
      )}

      {tab === "resultados" && (() => {
        const filteredResultados = resultados.filter(r => {
          const matchMatricula = r.matricula.toLowerCase().includes(filterMatricula.toLowerCase());
          const matchStatus = filterStatus === "Todos" || r.status === filterStatus;
          return matchMatricula && matchStatus;
        });

        return (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <h3 className="text-lg font-medium text-wfs-text ">Resultados das Avaliações</h3>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="FILTRAR MATRÍCULA..." 
                    className="w-48 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-[10px] font-medium  tracking-widest focus:outline-none focus:ring-2 focus:ring-wfs-accent/20 focus:border-wfs-accent transition-all"
                    value={filterMatricula}
                    onChange={e => setFilterMatricula(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    className="bg-transparent text-[10px] font-medium  text-slate-600 outline-none cursor-pointer border-none p-0"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                  >
                    <option value="Todos">STATUS: TODOS</option>
                    <option value="Aprovado">APROVADO</option>
                    <option value="Reprovado">REPROVADO</option>
                  </select>
                </div>

                <button 
                  onClick={loadResultados} 
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-[10px] font-medium  tracking-widest transition-all"
                >
                  Total ({filteredResultados.length})
                </button>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left table-fixed">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="w-64 p-4 text-[10px] font-medium  text-slate-500 tracking-wider">Colaborador</th>
                      <th className="w-40 p-4 text-[10px] font-medium  text-slate-500 tracking-wider">Curso</th>
                      <th className="w-24 p-4 text-[10px] font-medium  text-slate-500 tracking-wider text-center">Tentativa</th>
                      <th className="w-28 p-4 text-[10px] font-medium  text-slate-500 tracking-wider text-center">Data</th>
                      <th className="w-20 p-4 text-[10px] font-medium  text-slate-500 tracking-wider text-center">Nota</th>
                      <th className="w-24 p-4 text-[10px] font-medium  text-slate-500 tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResultados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-sm italic">Nenhum resultado encontrado.</td>
                      </tr>
                    ) : (
                      filteredResultados.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 truncate">
                            <p className="text-sm font-medium text-slate-800 truncate">{r.funcionario_nome}</p>
                            <p className="text-[10px] text-slate-400  tracking-wider">Matrícula: {r.matricula}</p>
                          </td>
                          <td className="p-4 text-sm text-slate-600 truncate">{r.curso_nome}</td>
                          <td className="p-4 text-center">
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-1 border border-slate-200  tracking-tighter">
                              {r.tentativa}ª Tentativa
                            </span>
                          </td>
                          <td className="p-4 text-center text-sm text-slate-600">{new Date(r.data_conclusao).toLocaleDateString()}</td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-mono font-medium text-slate-800">{Number(r.nota).toFixed(0)}%</span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 text-[10px] font-medium  border ${
                              r.status === 'Aprovado' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            <div className="bg-wfs-text p-4 text-white flex justify-between items-center">
              <h3 className="text-lg font-medium  tracking-tight">
                {step === 1 ? (createdCursoId ? "Editar Curso" : "Novo Curso") : "Gerenciar Conteúdo do Curso"}
              </h3>
              <button onClick={closeModal} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {showSuccess ? (
                <div className="text-center py-8 space-y-6">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-xl font-medium text-slate-800">Curso Publicado!</h4>
                    <p className="text-sm text-slate-500">O treinamento já está disponível no portal do colaborador.</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                    <p className="text-xs font-medium  text-slate-400">Link para Compartilhamento</p>
                    <div className="flex gap-2">
                      <input 
                        readOnly 
                        value={portalLink} 
                        className="input-field text-xs bg-white font-mono" 
                      />
                      <button onClick={copyLink} className="btn-primary p-2">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button onClick={closeModal} className="btn-primary w-full py-3 font-medium  tracking-widest">
                    Voltar ao Catálogo
                  </button>
                </div>
              ) : step === 1 ? (
                <form onSubmit={handleCreateCurso} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="text-xs font-medium  text-slate-500 mb-1 block">Capa do Treinamento</label>
                      <div className="aspect-square bg-slate-100 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer">
                        {formData.capa_url ? (
                          <img src={formData.capa_url} className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                            <span className="text-[10px] font-medium text-slate-400 ">Upload Foto</span>
                            <span className="text-[8px] text-slate-400 mt-1">Recomendado: 800x450px</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                          onChange={handleImageUpload}
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-6">
                      <div>
                        <label className="text-xs font-medium  text-slate-500 mb-1 block">Nome do Curso</label>
                        <input 
                          className="input-field" 
                          placeholder="Ex: Integração de Novos Colaboradores"
                          value={formData.nome} 
                          onChange={e => setFormData({...formData, nome: e.target.value})} 
                          required 
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                          <label className="text-xs font-medium  text-slate-500 mb-1 block">Data de Início</label>
                          <input 
                            type="date" 
                            className="input-field" 
                            value={formData.data_inicio} 
                            onChange={e => setFormData({...formData, data_inicio: e.target.value})} 
                            required 
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium  text-slate-500 mb-1 block">Data de Fim</label>
                          <input 
                            type="date" 
                            className="input-field" 
                            value={formData.data_fim} 
                            onChange={e => setFormData({...formData, data_fim: e.target.value})} 
                            required 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-500 font-medium  text-xs hover:text-slate-700 transition-colors">Cancelar</button>
                    <button type="submit" className="btn-primary flex items-center gap-2">
                      {createdCursoId ? "Salvar e Continuar" : "Criar e Continuar"} <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-8">
                  {/* Videos Section */}
                  <section className="space-y-4">
                    <h4 className="text-sm font-medium  text-slate-800 flex items-center gap-2 border-b pb-2">
                      <Video className="w-4 h-4 text-wfs-accent" /> Materiais de Estudo (Vídeos)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="text-[10px] font-medium  text-slate-400 block mb-1">Título do Vídeo</label>
                        <input 
                          placeholder="Ex: Introdução ao Sistema" 
                          className="input-field text-sm" 
                          value={videoData.titulo} 
                          onChange={e => setVideoData({...videoData, titulo: e.target.value})} 
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 relative">
                          <label className="text-[10px] font-medium  text-slate-400 block mb-1">Arquivo de Vídeo (Máx 20MB)</label>
                          <div className="relative h-10 border rounded-lg bg-white flex items-center px-3 cursor-pointer hover:border-wfs-accent transition-all">
                            <Video className="w-4 h-4 text-slate-400 mr-2" />
                            <span className="text-xs text-slate-500 truncate">
                              {videoData.url_video ? "Vídeo Selecionado" : "Selecionar MP4..."}
                            </span>
                            <input 
                              type="file" 
                              accept="video/mp4,video/x-m4v,video/*"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 20 * 1024 * 1024) {
                                    alert("Arquivo muito grande! Máximo 20MB.");
                                    return;
                                  }
                                  
                                  // Auto-fill title if empty
                                  if (!videoData.titulo) {
                                    const fileName = file.name.split('.').slice(0, -1).join('.');
                                    setVideoData(prev => ({ ...prev, titulo: fileName }));
                                  }

                                  const reader = new FileReader();
                                  setIsVideoLoading(true);
                                  reader.onloadend = () => {
                                    setVideoData(prev => ({ ...prev, url_video: reader.result as string }));
                                    setIsVideoLoading(false);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <button 
                          onClick={addVideo} 
                          disabled={isVideoLoading}
                          className="btn-primary h-10 px-4 flex items-center gap-2 disabled:opacity-50"
                        >
                          {isVideoLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-5 h-5" />
                          )}
                          <span className="text-xs font-medium ">
                            {isVideoLoading ? "Processando..." : "Adicionar"}
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {conteudos.map((v, i) => (
                        <div key={v.id} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-medium text-slate-400 bg-white w-5 h-5 flex items-center justify-center rounded-full border">{i + 1}</span>
                            <span className="text-sm font-medium text-slate-700">{v.titulo}</span>
                          </div>
                          <button 
                            onClick={() => deleteVideo(v.id)}
                            className="text-slate-400 hover:text-wfs-accent transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Evaluation Section */}
                  <section className="space-y-4">
                    <h4 className="text-sm font-medium  text-slate-800 flex items-center gap-2 border-b pb-2">
                      <ClipboardList className="w-4 h-4 text-wfs-accent" /> Avaliação Final
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-medium  text-slate-400 block mb-1">Nota Mínima (%)</label>
                        <input 
                          type="number" 
                          className="input-field text-sm" 
                          value={avaliacaoData.nota_minima} 
                          onChange={e => setAvaliacaoData({...avaliacaoData, nota_minima: parseInt(e.target.value)})} 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium  text-slate-400 block mb-1">Tentativas Máximas</label>
                        <input 
                          type="number" 
                          className="input-field text-sm" 
                          value={avaliacaoData.tentativas_maximas} 
                          onChange={e => setAvaliacaoData({...avaliacaoData, tentativas_maximas: parseInt(e.target.value)})} 
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                      <h5 className="text-xs font-medium  text-slate-500">Nova Questão</h5>
                      <input 
                        placeholder="Enunciado da Questão" 
                        className="input-field text-sm" 
                        value={novaQuestao.enunciado} 
                        onChange={e => setNovaQuestao({...novaQuestao, enunciado: e.target.value})} 
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {novaQuestao.opcoes.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input 
                              type="radio" 
                              name="correta" 
                              checked={opt.correta} 
                              onChange={() => {
                                const newOpts = novaQuestao.opcoes.map((o, i) => ({ ...o, correta: i === idx }));
                                setNovaQuestao({ ...novaQuestao, opcoes: newOpts });
                              }}
                            />
                            <input 
                              placeholder={`Opção ${idx + 1}`} 
                              className="input-field text-xs py-1.5" 
                              value={opt.texto} 
                              onChange={e => {
                                const newOpts = [...novaQuestao.opcoes];
                                newOpts[idx].texto = e.target.value;
                                setNovaQuestao({ ...novaQuestao, opcoes: newOpts });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <button onClick={addQuestao} className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-400 hover:border-wfs-accent hover:text-wfs-accent rounded-lg text-xs font-medium  transition-all">
                        Adicionar Questão à Prova
                      </button>
                    </div>

                    <div className="space-y-2">
                      {questoes.map((q, i) => (
                        <div key={q.id} className="p-3 bg-white border rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-medium text-slate-700">{i + 1}. {q.enunciado}</span>
                          </div>
                          <button 
                            onClick={() => deleteQuestao(q.id)}
                            className="text-slate-300 hover:text-wfs-accent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <button onClick={() => setStep(1)} className="px-4 py-2 text-slate-500 font-medium  text-xs hover:text-slate-700 transition-colors">Voltar</button>
                    <button onClick={saveAvaliacao} className="btn-primary flex items-center gap-2 px-8">
                      Finalizar e Publicar <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
