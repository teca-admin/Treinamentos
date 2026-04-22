import React, { useState, useEffect } from "react";
import { Plus, Video, ClipboardList, Trash2, Save, CheckCircle, X, Image as ImageIcon, Link as LinkIcon, Copy, Search, Filter, Youtube, ChevronDown, ChevronUp, FileText, Printer } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Contract } from "../types";
import { getSupabaseClient } from "../lib/supabase";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
  } catch (_) {}
  return null;
}

function isYoutubeUrl(url: string) {
  return !!getYoutubeEmbedUrl(url);
}

const formatDatePtLong = (dateStr: string) => {
  if (!dateStr) return '-';
  const months = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} DE ${months[d.getMonth()]} DE ${d.getFullYear()}`;
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface Opcao { texto: string; correta: boolean; }
interface Questao { id: number; enunciado: string; opcoes: Opcao[]; conteudo_id?: number | null; }
interface Conteudo { id: number; titulo: string; url_video: string; ordem: number; }

const TIPOS_CONTEUDO = ["SST", "Melhoria Contínua", "Informativo", "Comunicado"];

// ── Component ──────────────────────────────────────────────────────────────────

export const TreinamentoModule = ({ user, currentContract }: { user: User; currentContract: Contract }) => {
  const [tab, setTab] = useState("cursos");
  const [supabaseClient, setSupabaseClient] = useState<any>(null);

  useEffect(() => { getSupabaseClient().then(setSupabaseClient); }, []);

  const [cursos, setCursos] = useState<any[]>([]);
  const [resultados, setResultados] = useState<any[]>([]);
  const [filterMatricula, setFilterMatricula] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [createdCursoId, setCreatedCursoId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isManageLoading, setIsManageLoading] = useState<number | null>(null);

  // Known responsaveis/finalidades extracted from existing courses
  const [knownResponsaveis, setKnownResponsaveis] = useState<string[]>([]);
  const [knownFinalidades, setKnownFinalidades] = useState<string[]>([]);
  const [addingResponsavel, setAddingResponsavel] = useState(false);
  const [newResponsavelInput, setNewResponsavelInput] = useState("");
  const [addingFinalidade, setAddingFinalidade] = useState(false);
  const [newFinalidadeInput, setNewFinalidadeInput] = useState("");

  // Lista de presença
  const [showPresenca, setShowPresenca] = useState(false);
  const [presencaCurso, setPresencaCurso] = useState<any>(null);
  const [presencaParticipantes, setPresencaParticipantes] = useState<any[]>([]);
  const [isPresencaLoading, setIsPresencaLoading] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    data_inicio: new Date().toISOString().split("T")[0],
    data_fim: "",
    capa_url: "",
    tipo_conteudo: "",
    responsavel: "",
    finalidade: "",
    assunto: "",
  });

  // Video state — YouTube only
  const [videoData, setVideoData] = useState({ titulo: "", url_video: "" });
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);

  // Evaluation state
  const [avaliacaoData, setAvaliacaoData] = useState({ nota_minima: 70, tentativas_maximas: 3 });
  const [questoes, setQuestoes] = useState<Questao[]>([]);

  // Capa upload
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [capaPreview, setCapaPreview] = useState("");

  const load = () =>
    fetch(`/api/cursos?contrato=${currentContract}`)
      .then((r) => r.json())
      .then((data) => {
        setCursos(data);
        setKnownResponsaveis([...new Set(data.map((c: any) => c.responsavel).filter(Boolean))] as string[]);
        setKnownFinalidades([...new Set(data.map((c: any) => c.finalidade).filter(Boolean))] as string[]);
      });

  const loadResultados = () =>
    fetch(`/api/treinamentos/resultados?contrato=${currentContract}`)
      .then((r) => r.json())
      .then(setResultados);

  useEffect(() => { load(); loadResultados(); }, [currentContract]);

  const handleCapaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapaFile(file);
    setCapaPreview(URL.createObjectURL(file));
  };

  const uploadCapaToStorage = async (): Promise<string | null> => {
    if (!capaFile) return formData.capa_url || null;
    if (!supabaseClient) throw new Error("Supabase client não inicializado");
    const ext = capaFile.name.split(".").pop() || "jpg";
    const fileName = `capa-${Date.now()}.${ext}`;
    let { data: up, error } = await supabaseClient.storage.from("videos").upload(fileName, capaFile, { contentType: capaFile.type });
    if (error) {
      const { data: up2, error: e2 } = await supabaseClient.storage.from("treinamentos").upload(fileName, capaFile, { contentType: capaFile.type });
      if (e2) throw new Error(`Erro ao fazer upload da capa: ${e2.message}`);
      const { data: { publicUrl } } = supabaseClient.storage.from("treinamentos").getPublicUrl(up2.path);
      return publicUrl;
    }
    const { data: { publicUrl } } = supabaseClient.storage.from("videos").getPublicUrl(up.path);
    return publicUrl;
  };

  const handleCreateCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = createdCursoId ? "PUT" : "POST";
    const url = createdCursoId
      ? `/api/cursos/${createdCursoId}?contrato=${currentContract}`
      : `/api/cursos?contrato=${currentContract}`;

    let capaUrl = formData.capa_url;
    try { capaUrl = (await uploadCapaToStorage()) || ""; } catch (err: any) { alert(err.message); return; }

    const payload = { ...formData, capa_url: capaUrl, descricao: "" };
    const tempId = createdCursoId || Date.now();

    if (createdCursoId) {
      setCursos((prev) => prev.map((c) => (c.id === createdCursoId ? { ...c, ...payload } : c)));
    } else {
      setCursos((prev) => [{ ...payload, id: tempId }, ...prev]);
    }
    if (!createdCursoId) setCreatedCursoId(tempId);
    setStep(2);

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      const data = await res.json();
      if (!createdCursoId) {
        setCreatedCursoId(data.id);
        setCursos((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: data.id } : c)));
      }
    } else { load(); }
  };

  const manageContent = async (curso: any) => {
    setIsManageLoading(curso.id);
    try {
      setCreatedCursoId(curso.id);
      setFormData({
        nome: curso.nome,
        data_inicio: curso.data_inicio || new Date().toISOString().split("T")[0],
        data_fim: curso.data_fim || "",
        capa_url: curso.capa_url || "",
        tipo_conteudo: curso.tipo_conteudo || "",
        responsavel: curso.responsavel || "",
        finalidade: curso.finalidade || "",
        assunto: curso.assunto || "",
      });
      setCapaPreview(curso.capa_url || "");
      setCapaFile(null);

      const res = await fetch(`/api/cursos/${curso.id}/conteudo?contrato=${currentContract}`);
      const data = await res.json();
      setConteudos(data.conteudos || []);
      if (data.avaliacao) {
        setAvaliacaoData({ nota_minima: data.avaliacao.nota_minima, tentativas_maximas: data.avaliacao.tentativas_maximas });
        setQuestoes(data.questoes || []);
      } else {
        setAvaliacaoData({ nota_minima: 70, tentativas_maximas: 3 });
        setQuestoes([]);
      }
      setStep(1);
      setShowForm(true);
    } catch { alert("Erro ao carregar conteúdo do curso."); }
    finally { setIsManageLoading(null); }
  };

  const addVideo = async () => {
    if (!videoData.titulo) { alert("Insira um título para o vídeo."); return; }
    if (!youtubeUrl) { alert("Insira a URL do YouTube."); return; }
    setIsVideoLoading(true);
    try {
      const embed = getYoutubeEmbedUrl(youtubeUrl);
      if (!embed) { alert("URL do YouTube inválida."); return; }

      const res = await fetch(`/api/cursos/conteudo?contrato=${currentContract}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curso_id: createdCursoId, titulo: videoData.titulo, url_video: embed, ordem: conteudos.length + 1 }),
      });
      if (res.ok) {
        const saved = await res.json();
        setConteudos((prev) => [...prev, { titulo: videoData.titulo, url_video: embed, id: saved.id || Date.now(), ordem: prev.length + 1 }]);
        setVideoData({ titulo: "", url_video: "" });
        setYoutubeUrl("");
      } else {
        const d = await res.json();
        throw new Error(d.message || "Erro ao salvar no banco");
      }
    } catch (err: any) { alert(`Erro: ${err.message}`); }
    finally { setIsVideoLoading(false); }
  };

  const deleteVideo = async (id: number) => {
    if (!confirm("Remover este vídeo e suas atividades associadas?")) return;
    const prev = [...conteudos];
    setConteudos(conteudos.filter((c) => c.id !== id));
    setQuestoes((qs) => qs.filter((q) => q.conteudo_id !== id));
    const res = await fetch(`/api/cursos/conteudo/${id}?contrato=${currentContract}`, { method: "DELETE" });
    if (!res.ok) setConteudos(prev);
  };

  const saveAvaliacao = async () => {
    if (questoes.length === 0) { alert("Adicione pelo menos uma questão."); return; }
    const res = await fetch(`/api/cursos/avaliacao?contrato=${currentContract}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curso_id: createdCursoId, nota_minima: avaliacaoData.nota_minima, tentativas_maximas: avaliacaoData.tentativas_maximas, questoes }),
    });
    if (res.ok) setShowSuccess(true);
    else { const d = await res.json(); alert("Erro ao salvar: " + d.message); }
  };

  const closeModal = () => {
    setShowForm(false); setShowSuccess(false); setStep(1); setCreatedCursoId(null);
    setFormData({ nome: "", data_inicio: new Date().toISOString().split("T")[0], data_fim: "", capa_url: "", tipo_conteudo: "", responsavel: "", finalidade: "", assunto: "" });
    setCapaFile(null); setCapaPreview("");
    setConteudos([]); setQuestoes([]);
    setVideoData({ titulo: "", url_video: "" }); setYoutubeUrl("");
    setAddingResponsavel(false); setNewResponsavelInput("");
    setAddingFinalidade(false); setNewFinalidadeInput("");
  };

  const openPresenca = async (curso: any) => {
    setPresencaCurso(curso);
    setPresencaParticipantes([]);
    setIsPresencaLoading(true);
    setShowPresenca(true);
    try {
      const res = await fetch(`/api/cursos/${curso.id}/participantes?contrato=${currentContract}`);
      const data = await res.json();
      setPresencaParticipantes(data);
    } catch { alert("Erro ao carregar participantes."); }
    finally { setIsPresencaLoading(false); }
  };

  const handlePrintPresenca = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const dateStr = formatDatePtLong(presencaCurso?.data_inicio || '');
    const rows = presencaParticipantes.map((p, i) => `
      <tr>
        <td style="text-align:center;border:1px solid #ddd;padding:7px 6px">${i + 1}</td>
        <td style="border:1px solid #ddd;padding:7px 6px">${p.matricula || ''}</td>
        <td style="border:1px solid #ddd;padding:7px 6px">${p.nome || ''}</td>
        <td style="border:1px solid #ddd;padding:7px 6px">${p.cpf || ''}</td>
        <td style="border:1px solid #ddd;padding:7px 6px">${p.cargo || ''}</td>
        <td style="border:1px solid #ddd;padding:7px 6px;min-width:160px">&nbsp;</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>Lista de Presença - ${presencaCurso?.nome || ''}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:11px;color:#000;padding:20px}
      h1{color:#CC2222;font-size:17px;text-align:right;border-bottom:2px solid #CC2222;padding-bottom:5px;margin-bottom:12px;letter-spacing:1px}
      .curso-nome{font-size:12px;font-weight:bold;margin-bottom:10px;color:#333}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #bbb;margin-bottom:14px}
      .info-cell{padding:6px 10px;border-right:1px solid #bbb;border-bottom:1px solid #bbb}
      .info-cell:nth-child(even){border-right:none}
      .info-label{font-weight:bold;font-size:8px;text-transform:uppercase;color:#666;letter-spacing:.5px}
      .info-value{font-size:11px;margin-top:2px}
      table{width:100%;border-collapse:collapse}
      thead th{background:#CC2222;color:#fff;padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;border:1px solid #CC2222;letter-spacing:.5px}
      tbody td{vertical-align:middle}
      tbody tr:nth-child(even) td{background:#FFF5F5}
    </style></head><body>
    <h1>LISTA DE PRESENÇA</h1>
    <div class="curso-nome">${presencaCurso?.nome || ''}</div>
    <div class="info-grid">
      <div class="info-cell"><div class="info-label">Data</div><div class="info-value">${dateStr}</div></div>
      <div class="info-cell"><div class="info-label">Finalidade</div><div class="info-value">${presencaCurso?.finalidade || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Assunto</div><div class="info-value">${presencaCurso?.assunto || '-'}</div></div>
      <div class="info-cell"><div class="info-label">Multiplicador</div><div class="info-value">${presencaCurso?.responsavel || '-'}</div></div>
    </div>
    <table><thead><tr>
      <th style="width:40px;text-align:center">Nº</th>
      <th style="width:100px">Matrícula</th>
      <th>Nome</th>
      <th style="width:130px">CPF</th>
      <th style="width:150px">Função</th>
      <th style="width:170px">Assinatura</th>
    </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    win.document.close();
    win.print();
  };

  const portalLink = `${window.location.origin}/?portal=true`;
  const copyLink = () => { navigator.clipboard.writeText(portalLink); alert("Link copiado!"); };

  const questoesByConteudo = (conteudoId: number | null) =>
    questoes.filter((q) => q.conteudo_id === conteudoId);

  // ── Responsável dropdown helper ────────────────────────────────────────────────
  const confirmNewResponsavel = () => {
    const val = newResponsavelInput.trim();
    if (val) {
      setFormData((f) => ({ ...f, responsavel: val }));
      setKnownResponsaveis((prev) => [...new Set([...prev, val])]);
    }
    setAddingResponsavel(false);
    setNewResponsavelInput("");
  };

  const confirmNewFinalidade = () => {
    const val = newFinalidadeInput.trim();
    if (val) {
      setFormData((f) => ({ ...f, finalidade: val }));
      setKnownFinalidades((prev) => [...new Set([...prev, val])]);
    }
    setAddingFinalidade(false);
    setNewFinalidadeInput("");
  };

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        {["cursos", "resultados"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 px-4 text-xs font-medium tracking-wider transition-colors ${tab === t ? "border-b-2 border-wfs-accent text-wfs-accent" : "text-slate-400 hover:text-slate-600"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Cursos Tab */}
      {tab === "cursos" && (
        <div>
          <div className="bg-white p-4 border-2 border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
            <h2 className="text-xl font-medium text-slate-800 tracking-tighter flex items-center gap-2">
              <Video className="w-5 h-5 text-wfs-accent" /> Catálogo de Cursos
            </h2>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1.5 border-2 border-slate-200">
                <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">{portalLink}</span>
                <button onClick={copyLink} className="text-wfs-accent hover:text-red-700 p-1"><Copy className="w-3.5 h-3.5" /></button>
              </div>
              {(user.role === "Admin" || user.role === "Treinamento") && (
                <button onClick={() => { closeModal(); setShowForm(true); }}
                  className="bg-wfs-accent text-white font-medium text-xs tracking-widest px-6 py-3 rounded-none hover:bg-wfs-accent/90 transition-all shadow-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Criar Curso
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cursos.map((c) => (
              <div key={c.id} className="bg-white border-2 border-slate-200 flex flex-col justify-between overflow-hidden p-0">
                <div className="h-32 bg-slate-100 relative overflow-hidden border-b-2 border-slate-200">
                  {c.capa_url ? <img src={c.capa_url} alt={c.nome} className="w-full h-full object-cover" /> :
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8" /></div>}
                  {c.tipo_conteudo && (
                    <span className="absolute top-2 left-2 bg-wfs-accent text-white text-[9px] font-medium px-2 py-0.5 rounded tracking-wider">{c.tipo_conteudo}</span>
                  )}
                </div>
                <div className="p-4 flex-1">
                  <h4 className="font-medium text-slate-800 mb-1">{c.nome}</h4>
                  {c.assunto && <p className="text-[10px] text-slate-500 mb-1">{c.assunto}</p>}
                  <p className="text-[10px] text-slate-400 font-medium tracking-widest">
                    Disponível: {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString() : "-"} até {c.data_fim ? new Date(c.data_fim).toLocaleDateString() : "-"}
                  </p>
                </div>
                <div className="px-4 py-3 border-t-2 border-slate-200 bg-slate-50 flex justify-between items-center">
                  <button onClick={() => openPresenca(c)}
                    className="text-slate-400 text-[10px] font-medium hover:text-wfs-accent flex items-center gap-1 transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Lista de Presença
                  </button>
                  <button onClick={() => manageContent(c)} disabled={isManageLoading === c.id}
                    className="text-wfs-accent text-[10px] font-medium hover:underline flex items-center gap-1 disabled:opacity-50">
                    {isManageLoading === c.id && <div className="w-3 h-3 border-2 border-wfs-accent/30 border-t-wfs-accent rounded-full animate-spin" />}
                    {isManageLoading === c.id ? "Carregando..." : "Gerenciar Conteúdo"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resultados Tab */}
      {tab === "resultados" && (() => {
        const filtered = resultados.filter((r) => {
          const matchM = String(r.matricula || "").toLowerCase().includes(filterMatricula.toLowerCase());
          const matchS = filterStatus === "Todos" || r.status === filterStatus;
          return matchM && matchS;
        });
        return (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <h3 className="text-lg font-medium text-wfs-text">Resultados das Avaliações</h3>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" placeholder="FILTRAR MATRÍCULA..."
                    className="w-48 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-[10px] font-medium tracking-widest focus:outline-none focus:ring-2 focus:ring-wfs-accent/20 focus:border-wfs-accent transition-all"
                    value={filterMatricula} onChange={(e) => setFilterMatricula(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select className="bg-transparent text-[10px] font-medium text-slate-600 outline-none cursor-pointer border-none p-0"
                    value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="Todos">STATUS: TODOS</option>
                    <option value="Aprovado">APROVADO</option>
                    <option value="Reprovado">REPROVADO</option>
                  </select>
                </div>
                <button onClick={loadResultados} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-[10px] font-medium tracking-widest transition-all">
                  Total ({filtered.length})
                </button>
              </div>
            </div>
            <div className="bg-white border-2 border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left table-fixed">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      {["Colaborador", "Curso", "Tentativa", "Data", "Nota", "Status"].map((h) => (
                        <th key={h} className="p-4 text-[10px] font-medium text-slate-500 tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm italic">Nenhum resultado encontrado.</td></tr>
                    ) : filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 truncate">
                          <p className="text-sm font-medium text-slate-800 truncate">{r.funcionario_nome}</p>
                          <p className="text-[10px] text-slate-400 tracking-wider">Matrícula: {r.matricula}</p>
                        </td>
                        <td className="p-4 text-sm text-slate-600 truncate">{r.curso_nome}</td>
                        <td className="p-4 text-center">
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-1 border border-slate-200 tracking-tighter">{r.tentativa}ª</span>
                        </td>
                        <td className="p-4 text-center text-sm text-slate-600">{new Date(r.data_conclusao).toLocaleDateString()}</td>
                        <td className="p-4 text-center"><span className="text-sm font-mono font-medium text-slate-800">{Number(r.nota).toFixed(0)}%</span></td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 text-[10px] font-medium border ${r.status === "Aprovado" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal: Curso ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="bg-wfs-text p-4 text-white flex justify-between items-center">
              <h3 className="text-lg font-medium tracking-tight">
                {step === 1 ? (createdCursoId ? "Editar Curso" : "Novo Curso") : "Gerenciar Conteúdo"}
              </h3>
              <button onClick={closeModal} className="hover:bg-white/10 p-1 rounded transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 max-h-[85vh] overflow-y-auto">
              {showSuccess ? (
                <div className="text-center py-8 space-y-6">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto"><CheckCircle className="w-10 h-10" /></div>
                  <div><h4 className="text-xl font-medium text-slate-800">Curso Publicado!</h4><p className="text-sm text-slate-500">O treinamento já está disponível no portal do colaborador.</p></div>
                  <div className="flex gap-2 max-w-sm mx-auto">
                    <input readOnly value={portalLink} className="input-field text-xs bg-white font-mono" />
                    <button onClick={copyLink} className="btn-primary p-2"><Copy className="w-4 h-4" /></button>
                  </div>
                  <button onClick={closeModal} className="btn-primary w-full py-3 font-medium tracking-widest">Voltar ao Catálogo</button>
                </div>

              ) : step === 1 ? (
                /* Step 1: Basic Info */
                <form onSubmit={handleCreateCurso} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Capa do Treinamento</label>
                      <div className="aspect-square bg-slate-100 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer">
                        {capaPreview ? <img src={capaPreview} className="w-full h-full object-cover" /> : (
                          <><ImageIcon className="w-8 h-8 text-slate-300 mb-2" /><span className="text-[10px] font-medium text-slate-400">Upload Foto</span></>
                        )}
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleCapaFileChange} />
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Nome do Curso</label>
                        <input className="input-field" placeholder="Ex: Integração de Novos Colaboradores"
                          value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Data de Início</label>
                          <input type="date" className="input-field" value={formData.data_inicio}
                            onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Data de Fim</label>
                          <input type="date" className="input-field" value={formData.data_fim}
                            onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })} required />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo de Conteúdo</label>
                        <select className="input-field" value={formData.tipo_conteudo}
                          onChange={(e) => setFormData({ ...formData, tipo_conteudo: e.target.value })}>
                          <option value="">Selecionar tipo...</option>
                          {TIPOS_CONTEUDO.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Assunto */}
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Assunto do Treinamento</label>
                    <input className="input-field" placeholder="Ex: Integração, NR-35, Combate a Incêndio..."
                      value={formData.assunto} onChange={(e) => setFormData({ ...formData, assunto: e.target.value })} />
                  </div>

                  {/* Responsável */}
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Responsável (Multiplicador)</label>
                    {addingResponsavel ? (
                      <div className="flex gap-2">
                        <input className="input-field flex-1" placeholder="Nome do responsável"
                          value={newResponsavelInput} onChange={(e) => setNewResponsavelInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), confirmNewResponsavel())} autoFocus />
                        <button type="button" onClick={confirmNewResponsavel}
                          className="px-3 py-2 bg-wfs-accent text-white text-xs rounded hover:bg-red-700 transition-colors">OK</button>
                        <button type="button" onClick={() => { setAddingResponsavel(false); setNewResponsavelInput(""); }}
                          className="px-3 py-2 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200 transition-colors">Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select className="input-field flex-1" value={formData.responsavel}
                          onChange={(e) => {
                            if (e.target.value === "__add__") { setAddingResponsavel(true); }
                            else { setFormData({ ...formData, responsavel: e.target.value }); }
                          }}>
                          <option value="">Selecionar responsável...</option>
                          {knownResponsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
                          <option value="__add__">+ Cadastrar novo responsável...</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Finalidade */}
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Finalidade</label>
                    {addingFinalidade ? (
                      <div className="flex gap-2">
                        <input className="input-field flex-1" placeholder="Ex: Treinamento, Reciclagem, Integração..."
                          value={newFinalidadeInput} onChange={(e) => setNewFinalidadeInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), confirmNewFinalidade())} autoFocus />
                        <button type="button" onClick={confirmNewFinalidade}
                          className="px-3 py-2 bg-wfs-accent text-white text-xs rounded hover:bg-red-700 transition-colors">OK</button>
                        <button type="button" onClick={() => { setAddingFinalidade(false); setNewFinalidadeInput(""); }}
                          className="px-3 py-2 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200 transition-colors">Cancelar</button>
                      </div>
                    ) : (
                      <select className="input-field" value={formData.finalidade}
                        onChange={(e) => {
                          if (e.target.value === "__add__") { setAddingFinalidade(true); }
                          else { setFormData({ ...formData, finalidade: e.target.value }); }
                        }}>
                        <option value="">Selecionar finalidade...</option>
                        {knownFinalidades.map((f) => <option key={f} value={f}>{f}</option>)}
                        <option value="__add__">+ Cadastrar nova finalidade...</option>
                      </select>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-500 font-medium text-xs hover:text-slate-700 transition-colors">Cancelar</button>
                    <button type="submit" className="btn-primary flex items-center gap-2">
                      {createdCursoId ? "Salvar e Continuar" : "Criar e Continuar"} <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </form>

              ) : (
                /* Step 2: Content & Questions */
                <div className="space-y-8">
                  <section className="space-y-4">
                    <h4 className="text-sm font-medium text-slate-800 flex items-center gap-2 border-b pb-2">
                      <Youtube className="w-4 h-4 text-red-500" /> Adicionar Vídeo do YouTube
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 block mb-1">Título do Vídeo</label>
                        <input placeholder="Ex: Introdução ao Sistema" className="input-field text-sm"
                          value={videoData.titulo} onChange={(e) => setVideoData({ ...videoData, titulo: e.target.value })} />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[10px] font-medium text-slate-400 block mb-1">URL do YouTube</label>
                          <input placeholder="https://youtube.com/watch?v=..." className="input-field text-sm"
                            value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
                        </div>
                        <button type="button" onClick={addVideo} disabled={isVideoLoading}
                          className="btn-primary h-10 px-4 flex items-center gap-2 disabled:opacity-50 self-end">
                          {isVideoLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
                          <span className="text-xs font-medium">{isVideoLoading ? "Salvando..." : "Adicionar"}</span>
                        </button>
                      </div>
                    </div>
                  </section>

                  {conteudos.length > 0 && (
                    <section className="space-y-3">
                      <h4 className="text-sm font-medium text-slate-800 flex items-center gap-2 border-b pb-2">
                        <ClipboardList className="w-4 h-4 text-wfs-accent" /> Estrutura do Curso
                        <span className="text-[10px] text-slate-400 font-normal ml-1">(Vídeo → Atividade → Vídeo → Atividade...)</span>
                      </h4>

                      {conteudos.map((v, i) => {
                        const linked = questoesByConteudo(v.id);
                        return (
                          <div key={v.id} className="border-2 border-slate-200 rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between p-3 bg-slate-50">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-medium text-slate-400 bg-white w-6 h-6 flex items-center justify-center rounded-full border border-slate-200">{i + 1}</span>
                                <Youtube className="w-4 h-4 text-red-500" />
                                <span className="text-sm font-medium text-slate-700">{v.titulo}</span>
                                <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">YouTube</span>
                              </div>
                              <button type="button" onClick={() => deleteVideo(v.id)} className="text-slate-400 hover:text-wfs-accent transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="p-3 bg-white border-t border-slate-100 space-y-2">
                              {linked.length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {linked.map((q, qi) => (
                                    <div key={q.id} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-100">
                                      <span className="text-xs text-slate-700 flex items-center gap-2">
                                        <CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                        {qi + 1}. {q.enunciado}
                                      </span>
                                      <button type="button" onClick={() => setQuestoes((qs) => qs.filter((x) => x.id !== q.id))} className="text-slate-300 hover:text-wfs-accent shrink-0 ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <AddQuestionInline conteudoId={v.id}
                                onAdd={(q) => setQuestoes((prev) => [...prev, { ...q, id: Date.now(), conteudo_id: v.id }])} />
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  )}

                  <section className="space-y-4">
                    <h4 className="text-sm font-medium text-slate-800 flex items-center gap-2 border-b pb-2">
                      <ClipboardList className="w-4 h-4 text-wfs-accent" /> Configurações da Avaliação
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 block mb-1">Nota Mínima (%)</label>
                        <input type="number" className="input-field text-sm" value={avaliacaoData.nota_minima}
                          onChange={(e) => setAvaliacaoData({ ...avaliacaoData, nota_minima: parseInt(e.target.value) })} />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 block mb-1">Tentativas Máximas</label>
                        <input type="number" className="input-field text-sm" value={avaliacaoData.tentativas_maximas}
                          onChange={(e) => setAvaliacaoData({ ...avaliacaoData, tentativas_maximas: parseInt(e.target.value) })} />
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-[11px] text-blue-700 font-medium">
                        ℹ️ A nota final é calculada com base em <strong>todas</strong> as atividades respondidas ao longo do curso (cada questão tem peso igual).
                      </p>
                    </div>
                  </section>

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-slate-500 font-medium text-xs hover:text-slate-700 transition-colors">Voltar</button>
                    <button type="button" onClick={saveAvaliacao} className="btn-primary flex items-center gap-2 px-8">
                      Finalizar e Publicar <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal: Lista de Presença ── */}
      {showPresenca && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="bg-wfs-text p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="text-lg font-medium tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5" /> Lista de Presença
              </h3>
              <button onClick={() => setShowPresenca(false)} className="hover:bg-white/10 p-1 rounded transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Header info */}
              <div className="border border-wfs-accent/30 rounded-lg overflow-hidden mb-6">
                <div className="bg-wfs-accent px-4 py-2">
                  <h4 className="text-white text-sm font-medium tracking-widest">LISTA DE PRESENÇA</h4>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  {[
                    { label: "DATA", value: formatDatePtLong(presencaCurso?.data_inicio) },
                    { label: "FINALIDADE", value: presencaCurso?.finalidade || '-' },
                    { label: "ASSUNTO", value: presencaCurso?.assunto || '-' },
                    { label: "MULTIPLICADOR", value: presencaCurso?.responsavel || '-' },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 border-b border-slate-200">
                      <p className="text-[9px] font-bold text-slate-500 tracking-widest">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Participants table */}
              {isPresencaLoading ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="w-8 h-8 border-2 border-slate-200 border-t-wfs-accent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">Carregando participantes...</p>
                </div>
              ) : presencaParticipantes.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm">Nenhum colaborador realizou este treinamento ainda.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-wfs-accent">
                        {["Nº", "Matrícula", "Nome", "CPF", "Função", "Assinatura"].map((h) => (
                          <th key={h} className="px-3 py-2 text-[9px] font-bold text-white tracking-widest uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {presencaParticipantes.map((p, i) => (
                        <tr key={p.funcionario_id} className={i % 2 === 1 ? "bg-red-50/40" : ""}>
                          <td className="px-3 py-2.5 text-xs text-center font-medium text-slate-600">{i + 1}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-700 font-mono">{p.matricula}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-800 font-medium">{p.nome}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{p.cpf || '-'}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{p.cargo || '-'}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-300 min-w-[160px]">_______________</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <p className="text-[10px] text-slate-400">{presencaParticipantes.length} colaborador(es) · ordenado por nome</p>
              <div className="flex gap-3">
                <button onClick={() => setShowPresenca(false)}
                  className="px-4 py-2 text-slate-500 font-medium text-xs hover:text-slate-700 transition-colors">Fechar</button>
                <button onClick={handlePrintPresenca} disabled={presencaParticipantes.length === 0}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  <Printer className="w-4 h-4" /> Imprimir Lista
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// ── Inline Question Adder ──────────────────────────────────────────────────────

const AddQuestionInline = ({ conteudoId, onAdd }: { conteudoId: number; onAdd: (q: any) => void }) => {
  const [open, setOpen] = useState(false);
  const [enunciado, setEnunciado] = useState("");
  const [opcoes, setOpcoes] = useState([
    { texto: "", correta: true },
    { texto: "", correta: false },
    { texto: "", correta: false },
    { texto: "", correta: false },
  ]);

  const submit = () => {
    if (!enunciado.trim()) { alert("Insira o enunciado."); return; }
    if (opcoes.some((o) => !o.texto.trim())) { alert("Preencha todas as opções."); return; }
    onAdd({ enunciado, opcoes, conteudo_id: conteudoId });
    setEnunciado("");
    setOpcoes([{ texto: "", correta: true }, { texto: "", correta: false }, { texto: "", correta: false }, { texto: "", correta: false }]);
    setOpen(false);
  };

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-200 text-slate-400 hover:border-wfs-accent hover:text-wfs-accent rounded-lg text-xs font-medium transition-all">
        <Plus className="w-3.5 h-3.5" /> Adicionar Atividade após este vídeo
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-2 bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
            <input placeholder="Enunciado da questão" className="input-field text-sm w-full"
              value={enunciado} onChange={(e) => setEnunciado(e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {opcoes.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="radio" name={`inline-q-${conteudoId}-${idx}`} checked={opt.correta}
                    onChange={() => setOpcoes(opcoes.map((o, i) => ({ ...o, correta: i === idx })))} />
                  <input placeholder={`Opção ${idx + 1}`} className="input-field text-xs py-1.5 flex-1"
                    value={opt.texto}
                    onChange={(e) => { const n = [...opcoes]; n[idx] = { ...n[idx], texto: e.target.value }; setOpcoes(n); }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={submit} className="btn-primary text-xs px-4 py-2 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Confirmar</button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs px-4 py-2 text-slate-400 hover:text-slate-600">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
