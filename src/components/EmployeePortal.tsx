import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight, Video, ClipboardList, ArrowLeft, CheckCircle,
  AlertCircle, Lock, LogOut, Maximize2, Play
} from "lucide-react";
import { motion } from "motion/react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function isYoutubeUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname === "youtu.be" || u.hostname.includes("youtube.com");
  } catch { return false; }
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Conteudo { id: number; titulo: string; url_video: string; ordem: number; }
interface Opcao { id: number; texto: string; correta: boolean | number; }
interface Questao { id: number; enunciado: string; opcoes: Opcao[]; conteudo_id?: number | null; }

// Mapa de flags para cargos — deve coincidir com TreinamentoModule
const CARGO_TO_FLAG: Record<string, string> = {
  "AUXILIAR DE SERVICOS AEROPORTUARIOS/RAMPA": "Auxiliar",
  "OPERADOR DE EQUIPAMENTOS/RAMPA": "OPE",
  "ANALISTA DE MELHORIA CONTINUA I": "Analista",
  "TÉCNICO DE SEGURANÇA DO TRABALHO": "TST",
  "TECNICO DE SEGURANCA DO TRABALHO II": "TST",
  "LIDER DE CARGAS II/RAMPA": "Lider",
};

function getEmployeeFlag(cargo: string): string | null {
  return CARGO_TO_FLAG[cargo?.trim().toUpperCase()] || null;
}

function cursoVisibleToEmployee(curso: any, employeeFlag: string | null): boolean {
  const pa: string[] = Array.isArray(curso.publico_alvo) ? curso.publico_alvo : [];
  if (pa.length === 0) return true; // sem restrição → todos veem
  if (!employeeFlag) return false; // funcionário sem flag → vê apenas cursos sem restrição
  return pa.includes(employeeFlag);
}

export const EmployeePortal = ({ onExit }: { onExit?: () => void }) => {
  const [step, setStep] = useState(1);
  const [cpf, setCpf] = useState("");
  const [turno, setTurno] = useState("");
  const [employee, setEmployee] = useState<any>(null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [selectedCurso, setSelectedCurso] = useState<any>(null);
  const [content, setContent] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [watchedCurrent, setWatchedCurrent] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [activityAnswered, setActivityAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const [isExamLoading, setIsExamLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isCursoLoading, setIsCursoLoading] = useState(false);

  // ── Pesquisa de satisfação ────────────────────────────────────────────────────
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, number>>({});
  const [surveySetor, setSurveySetor] = useState("");
  const [surveyGostou, setSurveyGostou] = useState("");
  const [surveyMelhorar, setSurveyMelhorar] = useState("");
  const [isSurveyLoading, setIsSurveyLoading] = useState(false);

  // ── Logout ────────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setEmployee(null); setStep(1); setCpf(""); setTurno("");
    setSelectedCurso(null); setContent(null); setResult(null);
    setItems([]); setAnswers({}); setCurrentItemIndex(0);
    setSurveyAnswers({}); setSurveySetor("");
    setSurveyGostou(""); setSurveyMelhorar("");
  };

  // ── Login ─────────────────────────────────────────────────────────────────────
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cpf) return;
    if (!turno) { alert("Selecione seu turno para continuar."); return; }
    setIsLoginLoading(true);
    try {
      // Normaliza CPF: remove qualquer pontuação antes de enviar
      const cpfLimpo = cpf.replace(/[^0-9]/g, "");
      const res = await fetch("/api/funcionarios/cpf/" + cpfLimpo);
      const data = await res.json();
      if (data.success && data.funcionario) {
        const emp = data.funcionario;
        setEmployee(emp);
        const employeeFlag = getEmployeeFlag(emp.cargo || "");
        const [rres, cres] = await Promise.all([
          fetch(`/api/treinamentos/resultados?funcionario_id=${emp.id}`),
          fetch("/api/cursos"),
        ]);
        const rdata = await rres.json();
        const cdata = await cres.json();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const processed = cdata
          .filter((c: any) => cursoVisibleToEmployee(c, employeeFlag)) // ← filtro por público alvo
          .map((c: any) => {
          const startDate = c.data_inicio ? new Date(c.data_inicio) : null;
          const endDate = c.data_fim ? new Date(c.data_fim) : null;
          if (startDate) startDate.setHours(0, 0, 0, 0);
          if (endDate) endDate.setHours(23, 59, 59, 999);
          const isStarted = !startDate || today >= startDate;
          const isNotEnded = !endDate || today <= endDate;
          const courseResults = rdata.filter((r: any) => r.curso_id === c.id);
          const isApproved = courseResults.some((r: any) => r.status === "Aprovado");
          const reprovadoCount = courseResults.filter((r: any) => r.status === "Reprovado").length;
          const attemptsExceeded = reprovadoCount >= 3;
          let isBlocked = !isStarted || !isNotEnded || attemptsExceeded || isApproved;
          let blockReason = "";
          if (!isStarted) blockReason = "Ainda não disponível";
          else if (!isNotEnded) blockReason = "Período encerrado";
          else if (isApproved) blockReason = "Treinamento Concluído";
          else if (attemptsExceeded) blockReason = "Limite de tentativas excedido (3)";
          return { ...c, isBlocked, blockReason, isApproved, reprovadoCount };
        });
        setCursos(processed);
        setStep(2);
      } else { alert("CPF não encontrado"); }
    } catch { alert("Erro ao acessar o portal. Tente novamente."); }
    finally { setIsLoginLoading(false); }
  };

  // ── Start Curso ───────────────────────────────────────────────────────────────
  const startCurso = async (curso: any) => {
    setIsCursoLoading(true);
    try {
      setSelectedCurso(curso);
      const res = await fetch(`/api/cursos/${curso.id}/conteudo`);
      const data = await res.json();
      setContent(data);

      const built: any[] = [];
      const conteudos: Conteudo[] = data.conteudos || [];
      const questoes: Questao[] = data.questoes || [];

      // A partir da 2ª tentativa (reprovadoCount > 0), busca quais vídeos já foram assistidos
      let watchedVideoIds: number[] = [];
      const isRetry = curso.reprovadoCount > 0;
      if (isRetry && employee?.id) {
        try {
          const wRes = await fetch(`/api/videos-assistidos/${employee.id}/${curso.id}`);
          const wData = await wRes.json();
          watchedVideoIds = wData.watched || [];
        } catch { /* se falhar, não bloqueia — trata como não assistido */ }
      }

      conteudos.forEach((v) => {
        const alreadyWatched = isRetry && watchedVideoIds.includes(v.id);
        // Na 2ª+ tentativa, se o vídeo já foi assistido, não adiciona ao fluxo
        if (!alreadyWatched) {
          built.push({ type: "video", data: v, videoId: v.id });
        }
        const linked = questoes.filter((q) => q.conteudo_id === v.id);
        linked.forEach((q) => built.push({ type: "question", data: q, videoId: v.id }));
      });
      const unlinked = questoes.filter((q) => !q.conteudo_id);
      unlinked.forEach((q) => built.push({ type: "question", data: q, videoId: null }));

      // Se todos os vídeos foram pulados (retry completo), garante que há pelo menos as questões
      setItems(built);
      setCurrentItemIndex(0);
      setAnswers({});
      setWatchedCurrent(false);
      setActivityAnswered(false);
      setSelectedOption(null);
      setStep(3);
    } catch { alert("Erro ao carregar conteúdo do curso."); }
    finally { setIsCursoLoading(false); }
  };

  // ── Visibility change guard ───────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && step === 3) {
        alert("Você saiu da tela do curso! Por segurança, o curso será reiniciado.");
        setStep(2); setSelectedCurso(null); setContent(null);
        setItems([]); setAnswers({}); setCurrentItemIndex(0);
        setWatchedCurrent(false); setActivityAnswered(false); setSelectedOption(null);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [step]);

  // ── Current item helpers ──────────────────────────────────────────────────────
  const currentItem = items[currentItemIndex];
  const isLastItem = currentItemIndex === items.length - 1;
  const progressPct = items.length > 0 ? (currentItemIndex / items.length) * 100 : 0;

  const canAdvance = () => {
    if (!currentItem) return false;
    if (currentItem.type === "video") return watchedCurrent;
    if (currentItem.type === "question") return activityAnswered;
    return false;
  };

  const markVideoWatched = async (conteudoId: number) => {
    if (!employee?.id || !selectedCurso?.id) return;
    try {
      await fetch("/api/videos-assistidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionario_id: employee.id, curso_id: selectedCurso.id, conteudo_id: conteudoId }),
      });
    } catch { /* silencioso — não bloqueia o fluxo */ }
  };

  const handleSelectOption = (questionId: number, optionId: number) => {
    // Permite trocar a resposta livremente enquanto não avançar
    setSelectedOption(optionId);
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    // Marca como respondida para habilitar o botão Próximo, mas NÃO trava as opções
    setActivityAnswered(true);
  };

  const advance = () => {
    if (!canAdvance()) return;
    if (isLastItem) {
      submitExam();
    } else {
      setCurrentItemIndex((i) => i + 1);
      setWatchedCurrent(false);
      setActivityAnswered(false);
      setSelectedOption(null);
    }
  };

  // ── Submit exam ───────────────────────────────────────────────────────────────
  const submitExam = async () => {
    setIsExamLoading(true);
    try {
      const questoes: Questao[] = content?.questoes || [];
      let score = 0;
      if (questoes.length > 0) {
        let acertos = 0;
        questoes.forEach((q) => {
          const correctOpt = q.opcoes.find((o) => o.correta === true || o.correta === 1);
          if (correctOpt && answers[q.id] === correctOpt.id) acertos++;
        });
        // Arredonda para evitar erros de ponto flutuante (ex: 99.9999... ao invés de 100)
        score = Math.round((acertos / questoes.length) * 100);
      } else { score = 100; }

      const res = await fetch("/api/treinamentos/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionario_id: employee.id, curso_id: selectedCurso.id, nota: score, turno }),
      });
      const data = await res.json();
      // Captura o reprovadoCount ANTES do incremento para exibição correta na tela de resultado
      const currentReprovadoCount = cursos.find((c) => c.id === selectedCurso.id)?.reprovadoCount || 0;
      const newReprovadoCount = currentReprovadoCount + (data.status === "Reprovado" ? 1 : 0);
      setResult({ score, status: data.status, tentativaAtual: newReprovadoCount });

      setCursos((prev) => prev.map((c) => {
        if (c.id !== selectedCurso.id) return c;
        const isApproved = c.isApproved || data.status === "Aprovado";
        const reprovadoCount = newReprovadoCount;
        const attemptsExceeded = reprovadoCount >= 3;
        const isBlocked = isApproved || attemptsExceeded;
        const blockReason = isApproved ? "Treinamento Concluído" : attemptsExceeded ? "Limite de tentativas excedido (3)" : c.blockReason;
        return { ...c, isApproved, reprovadoCount, isBlocked, blockReason };
      }));

      // Aprovado → vai para pesquisa (step 5); reprovado → resultado (step 4)
      setStep(data.status === "Aprovado" ? 5 : 4);
    } catch { alert("Erro ao enviar avaliação. Verifique sua conexão."); }
    finally { setIsExamLoading(false); }
  };

  // ── Submit survey ─────────────────────────────────────────────────────────────
  const submitSurvey = async (skip = false) => {
    setIsSurveyLoading(true);
    try {
      if (!skip) {
        await fetch("/api/pesquisa-satisfacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            funcionario_id: employee.id,
            curso_id: selectedCurso.id,
            nome_opcional: null,
            setor: surveySetor || null,
            respostas: surveyAnswers,
            sugestao_gostou: surveyGostou || null,
            sugestao_melhorar: surveyMelhorar || null,
          }),
        });
      }
    } catch { /* silencioso — não bloqueia o fluxo */ }
    finally {
      setIsSurveyLoading(false);
      // Após pesquisa, mostra resultado final
      setStep(4);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-wfs-bg flex flex-col">
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-wfs-accent py-3 px-6 text-white flex justify-between items-center sticky top-0 z-10 shadow-md">
          <div className="flex items-center gap-4">
            {!employee && step !== 1 && onExit && (
              <button onClick={onExit} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-4 h-4" /></button>
            )}
            <div>
              <h1 className="text-lg font-medium tracking-tighter leading-tight">WFS Treinamentos</h1>
              <p className="text-[8px] tracking-widest opacity-60">Ambiente do Colaborador</p>
            </div>
          </div>
          {employee && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-medium">{employee.nome}</p>
                <p className="text-[9px] opacity-60">CPF: {employee.cpf ? employee.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : employee.matricula} · {turno}</p>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-all"><LogOut className="w-5 h-5" /></button>
            </div>
          )}
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto">

          {/* ── Step 1: Login ── */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm mx-auto space-y-6 bg-white p-8 rounded-2xl shadow-xl mt-20">
              <h2 className="text-xl font-medium text-center text-slate-800">Acesse seus Treinamentos</h2>
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">CPF</label>
                  <input
                    className="input-field text-center text-xl font-mono tracking-widest"
                    value={cpf}
                    onChange={(e) => {
                      // Aplica máscara 000.000.000-00
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let masked = digits;
                      if (digits.length > 9) masked = digits.slice(0,3) + "." + digits.slice(3,6) + "." + digits.slice(6,9) + "-" + digits.slice(9);
                      else if (digits.length > 6) masked = digits.slice(0,3) + "." + digits.slice(3,6) + "." + digits.slice(6);
                      else if (digits.length > 3) masked = digits.slice(0,3) + "." + digits.slice(3);
                      setCpf(masked);
                    }}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Turno <span className="text-wfs-accent">*</span></label>
                  <select
                    className="input-field"
                    value={turno}
                    onChange={(e) => setTurno(e.target.value)}
                    required
                  >
                    <option value="">Selecione seu turno...</option>
                    <option value="1° Turno">1° Turno</option>
                    <option value="2° Turno">2° Turno</option>
                    <option value="3° Turno">3° Turno</option>
                  </select>
                </div>
                <button type="submit" disabled={isLoginLoading || !turno || cpf.replace(/\D/g,"").length < 11}
                  className="btn-primary w-full py-4 font-medium tracking-widest disabled:opacity-50">
                  {isLoginLoading ? "Acessando..." : "Entrar no Portal"}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Step 2: Course List ── */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto w-full space-y-6">
              <h2 className="text-lg font-medium text-slate-700 border-b pb-4 mb-6">Seus Cursos Disponíveis</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                {cursos.map((c) => (
                  <div key={c.id} onClick={() => !c.isBlocked && startCurso(c)}
                    className={`card transition-all overflow-hidden p-0 flex flex-col ${c.isBlocked ? "opacity-60 grayscale cursor-not-allowed" : "hover:border-wfs-accent cursor-pointer group"}`}>
                    <div className="aspect-video bg-slate-100 relative">
                      {c.capa_url ? <img src={c.capa_url} alt={c.nome} className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Video className="w-6 h-6" /></div>}
                      {c.isBlocked && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="bg-white/90 px-3 py-1 rounded-full flex items-center gap-2">
                            <Lock className="w-3 h-3 text-red-600" />
                            <span className="text-[10px] font-medium text-red-600 tracking-wider">Bloqueado</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 md:p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className={`font-medium text-sm leading-tight ${!c.isBlocked && "group-hover:text-wfs-accent"} transition-colors`}>{c.nome}</h3>
                        {c.isApproved && <span className="bg-green-100 text-green-700 text-[8px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">Aprovado</span>}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-auto pt-3 gap-2">
                        <div className={`flex items-center text-[9px] md:text-[10px] font-medium gap-1 ${c.isBlocked ? "text-slate-400" : "text-wfs-accent"}`}>
                          {isCursoLoading && selectedCurso?.id === c.id && <div className="w-3 h-3 border-2 border-wfs-accent/30 border-t-wfs-accent rounded-full animate-spin mr-1" />}
                          {c.isBlocked ? c.blockReason : "Iniciar Treinamento"} {!c.isBlocked && <ChevronRight className="w-3 h-3" />}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-slate-500 font-medium">Até {c.data_fim ? new Date(c.data_fim).toLocaleDateString() : "-"}</p>
                          {!c.isApproved && <p className="text-[9px] text-slate-400 font-medium">Tentativas: {c.reprovadoCount}/3</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Interleaved Course Flow ── */}
          {step === 3 && currentItem && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto w-full space-y-6">
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(2)} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-xs font-medium">
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <div className="text-right">
                  <p className="text-[10px] font-medium text-slate-400 mb-1">Progresso</p>
                  <div className="flex items-center gap-2">
                    <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} className="h-full bg-green-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{progressPct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-medium text-wfs-text">{selectedCurso?.nome}</h2>

              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium tracking-widest">
                <span className="bg-slate-100 px-2 py-1 rounded">{currentItemIndex + 1} / {items.length}</span>
                <span>{currentItem.type === "video" ? "📹 VÍDEO" : "📝 ATIVIDADE"}</span>
              </div>

              {/* VIDEO ITEM */}
              {currentItem.type === "video" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-slate-700">{currentItem.data.titulo}</p>
                    {watchedCurrent && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
                        <CheckCircle className="w-3 h-3" /> Concluído
                      </span>
                    )}
                  </div>

                  <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
                    {isYoutubeUrl(currentItem.data.url_video) ? (
                      <YoutubePlayer src={currentItem.data.url_video} onEnded={() => {
                        setWatchedCurrent(true);
                        markVideoWatched(currentItem.data.id);
                      }} />
                    ) : (
                      <RestrictedVideoPlayer src={currentItem.data.url_video} onEnded={() => {
                        setWatchedCurrent(true);
                        markVideoWatched(currentItem.data.id);
                      }} />
                    )}
                  </div>

                  {!watchedCurrent && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Assista o vídeo até o final para continuar.
                    </div>
                  )}

                  <button onClick={advance} disabled={!canAdvance()}
                    className="btn-primary w-full py-3 font-medium tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isLastItem ? (isExamLoading ? "Enviando..." : "Finalizar Curso") : "Próximo"} <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* QUESTION ITEM */}
              {currentItem.type === "question" && (
                <div className="space-y-4 bg-white border-2 border-slate-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-xs font-medium text-wfs-accent">
                    <ClipboardList className="w-4 h-4" /> Atividade
                  </div>
                  <p className="font-medium text-slate-800 text-base">{currentItem.data.enunciado}</p>
                  <div className="space-y-2">
                    {currentItem.data.opcoes.map((opt: Opcao) => {
                      const isSelected = selectedOption === opt.id;
                      return (
                        <label key={opt.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none
                            ${isSelected
                              ? "border-wfs-accent bg-blue-50 font-medium"
                              : "hover:bg-slate-50 border-slate-200"}`}>
                          <input type="radio" name={`q-${currentItem.data.id}`} checked={isSelected}
                            onChange={() => handleSelectOption(currentItem.data.id, opt.id)}
                            className="accent-wfs-accent" />
                          <span className="text-sm">{opt.texto}</span>
                        </label>
                      );
                    })}
                  </div>

                  {!activityAnswered && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Selecione uma opção para continuar. Você pode trocar sua resposta antes de avançar.
                    </div>
                  )}

                  {activityAnswered && (
                    <div className="pt-2 space-y-1">
                      <p className="text-[10px] text-slate-400 text-center">Pode trocar sua resposta antes de avançar.</p>
                      <button onClick={advance}
                        className="btn-primary w-full py-3 font-medium tracking-widest flex items-center justify-center gap-2">
                        {isLastItem ? (isExamLoading ? "Enviando..." : "Finalizar Curso") : "Próximo"} <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 4: Result ── */}
          {step === 4 && result && (() => {
            const currentCurso = cursos.find((c) => c.id === selectedCurso?.id);
            const tentativaAtual = result.tentativaAtual ?? (currentCurso?.reprovadoCount || 0);
            const attemptsLeft = 3 - tentativaAtual;
            const canRetry = attemptsLeft > 0 && !currentCurso?.isApproved;
            const isApproved = result.status === "Aprovado";

            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto py-12 px-8 bg-white border border-slate-200 shadow-sm rounded-lg">

                <div className="text-center space-y-4 mb-8">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border ${isApproved ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-wfs-accent border-red-100"}`}>
                    {isApproved ? <CheckCircle className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-medium text-slate-900 tracking-tight">
                      {isApproved ? "Treinamento Concluído" : "Desempenho Insuficiente"}
                    </h2>
                    <p className="text-slate-500 text-sm">
                      {isApproved ? "Você atingiu a pontuação necessária para aprovação." : "Sua pontuação foi inferior ao mínimo exigido."}
                    </p>
                  </div>
                  {!isApproved && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded text-[10px] font-medium text-slate-600 tracking-widest border border-slate-200">
                      Tentativa {tentativaAtual} de 3
                    </div>
                  )}
                </div>

                <div className="py-8 border-y border-slate-100 flex flex-col items-center mb-8">
                  <span className="text-[10px] font-medium text-slate-400 tracking-[0.2em] mb-2">Pontuação Final</span>
                  <span className="text-7xl font-mono font-light text-slate-900 tracking-tighter">
                    {result.score.toFixed(0)}<span className="text-2xl text-slate-300 ml-1">%</span>
                  </span>
                </div>

                <div className="flex flex-col items-center gap-4">
                  {!isApproved && canRetry ? (
                    <button onClick={() => startCurso(currentCurso || selectedCurso)}
                      className="w-full max-w-xs bg-wfs-accent hover:bg-red-700 text-white py-4 rounded font-medium text-xs tracking-[0.2em] transition-all shadow-lg">
                      Tentar Novamente
                    </button>
                  ) : (
                    <button onClick={() => { setStep(2); setSelectedCurso(null); setResult(null); }}
                      className="w-full max-w-xs bg-slate-900 hover:bg-slate-800 text-white py-4 rounded font-medium text-xs tracking-[0.2em] transition-all">
                      Voltar para meus cursos
                    </button>
                  )}
                  {isApproved && <p className="text-[10px] text-slate-400 font-medium tracking-widest">O certificado será emitido automaticamente pelo RH.</p>}
                  {!isApproved && !canRetry && <p className="text-xs font-medium text-red-600 tracking-widest">Limite de tentativas excedido para este curso.</p>}
                </div>
              </motion.div>
            );
          })()}
          {/* ── Step 5: Pesquisa de Satisfação (apenas aprovados) ── */}
          {step === 5 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto py-8 space-y-6">

              {/* Cabeçalho */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Avaliação de Reação do Treinamento</h2>
                    <p className="text-xs text-slate-400">Sua opinião é muito importante para melhorarmos nossos treinamentos.</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="text-[10px] font-medium text-slate-400 block mb-1 tracking-wider">SETOR <span className="text-wfs-accent">*</span></label>
                    <select className="input-field text-sm" value={surveySetor} onChange={e => setSurveySetor(e.target.value)} required>
                      <option value="">Selecione seu setor...</option>
                      <option>Importação</option>
                      <option>Internação</option>
                      <option>Carga Nacional</option>
                      <option>Paletizada</option>
                      <option>Exportação</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Escala de referência */}
              <div className="flex flex-wrap gap-2 px-1">
                {[["1","Péssimo","bg-red-100 text-red-700"],["2","Ruim","bg-orange-100 text-orange-700"],["3","Regular","bg-yellow-100 text-yellow-700"],["4","Bom","bg-blue-100 text-blue-700"],["5","Excelente","bg-green-100 text-green-700"]].map(([n,l,cls]) => (
                  <span key={n} className={`px-3 py-1 rounded-full text-[11px] font-semibold ${cls}`}>{n} — {l}</span>
                ))}
              </div>

              {/* Questões */}
              {[
                [1, "Como você avalia o conteúdo apresentado no treinamento?"],
                [2, "O treinamento foi claro e fácil de entender?"],
                [3, "O instrutor demonstrou domínio do assunto?"],
                [4, "O tempo de duração do treinamento foi adequado?"],
                [5, "Os exemplos utilizados foram aplicáveis ao ambiente logístico?"],
                [6, "O treinamento contribuiu para aumentar sua percepção de riscos?"],
                [7, "Você se sente mais preparado para reportar acidentes e incidentes?"],
                [8, "Os recursos utilizados (slides, imagens, exemplos) foram adequados?"],
                [9, "Você recomendaria este treinamento para outros colaboradores?"],
                [10, "Sua satisfação geral com o treinamento foi:"],
              ].map(([num, pergunta]) => {
                const key = `q${num}`;
                const val = surveyAnswers[key];
                const colors = ["","bg-red-500","bg-orange-500","bg-yellow-500","bg-blue-500","bg-green-500"];
                return (
                  <div key={key} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-700 mb-3">
                      <span className="text-wfs-accent font-bold mr-1">{num as number}.</span> {pergunta as string}
                    </p>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button"
                          onClick={() => setSurveyAnswers(prev => ({ ...prev, [key]: n }))}
                          className={`flex-1 h-10 rounded-lg font-bold text-sm transition-all border-2 ${val === n ? `${colors[n]} text-white border-transparent shadow-md scale-105` : "border-slate-200 text-slate-400 hover:border-slate-400 bg-white"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Sugestões abertas */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">💬 Sugestões de Melhoria</h3>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">O que você mais gostou no treinamento?</label>
                  <textarea className="input-field text-sm w-full resize-none" rows={2}
                    placeholder="Compartilhe o que foi mais valioso para você..."
                    value={surveyGostou} onChange={e => setSurveyGostou(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">O que pode ser melhorado?</label>
                  <textarea className="input-field text-sm w-full resize-none" rows={2}
                    placeholder="Sua sugestão nos ajuda a melhorar..."
                    value={surveyMelhorar} onChange={e => setSurveyMelhorar(e.target.value)} />
                </div>
              </div>

              {/* Botões */}
              <div className="flex flex-col sm:flex-row gap-3 pb-8">
                <button
                  onClick={() => submitSurvey(false)}
                  disabled={isSurveyLoading || !surveySetor || Object.keys(surveyAnswers).length < 10}
                  className="flex-1 bg-wfs-accent hover:bg-red-700 disabled:opacity-50 text-white py-4 rounded-lg font-medium text-xs tracking-[0.2em] transition-all shadow-lg disabled:cursor-not-allowed">
                  {isSurveyLoading ? "Enviando..." : "Enviar Avaliação"}
                </button>
                <button
                  onClick={() => submitSurvey(true)}
                  disabled={isSurveyLoading}
                  className="px-6 py-4 rounded-lg font-medium text-xs text-slate-400 hover:text-slate-600 border border-slate-200 transition-all">
                  Pular
                </button>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrai o video ID do YouTube de qualquer formato de URL e retorna a embed URL
 *  com todos os parâmetros necessários já configurados. */
function buildYoutubeEmbedUrl(src: string): string {
  try {
    const u = new URL(src);
    let videoId = "";

    if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1).split("?")[0];
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.split("/embed/")[1].split("?")[0];
      } else {
        videoId = u.searchParams.get("v") || "";
      }
    }

    if (!videoId) return src;

    const params = new URLSearchParams({
      enablejsapi: "1",
      origin: window.location.origin,
      controls: "1",          // mantém controles nativos (play/pause/volume/full)
      rel: "0",               // sem vídeos relacionados
      modestbranding: "1",
      iv_load_policy: "3",    // sem anotações
      disablekb: "1",         // sem atalhos de teclado
      playsinline: "1",
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return src;
  }
}

function formatSeconds(s: number): string {
  if (!isFinite(s) || s < 0) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── YouTube Player ────────────────────────────────────────────────────────────

const YoutubePlayer = ({ src, onEnded }: { src: string; onEnded: () => void }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const endedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // HUD state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playing, setPlaying] = useState(false);
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const embedSrc = buildYoutubeEmbedUrl(src);

  const postCmd = (func: string, args: any[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }), "*"
      );
    } catch {}
  };

  const triggerEnded = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPlaying(false);
    onEnded();
  };

  const setPlaybackRate = (r: number) => {
    setSpeed(r);
    setShowSpeedMenu(false);
    postCmd("setPlaybackRate", [r]);
  };

  const handleIframeLoad = () => {
    endedRef.current = false;
    // Registra listeners de eventos do YouTube IFrame API
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening" }), "*"
      );
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }), "*"
      );
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "addEventListener", args: ["onReady"] }), "*"
      );
    } catch {}

    // Polling a cada 1s: pede currentTime, duration e playerState
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (endedRef.current) { clearInterval(pollRef.current!); return; }
      postCmd("getDuration");
      postCmd("getCurrentTime");
      postCmd("getPlayerState");
    }, 1000);
  };

  useEffect(() => {
    endedRef.current = false;
    setTimeRemaining(null);
    setDuration(null);
    setPlaying(false);

    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!data) return;

        // Estado do player (play/pause/ended)
        if (data.event === "onStateChange") {
          const state = data.info;
          if (state === 0) { triggerEnded(); return; }
          setPlaying(state === 1);
        }

        // Resposta de getDuration / getCurrentTime / getPlayerState
        if (data.event === "infoDelivery" && data.info) {
          const info = data.info;

          // Estado via infoDelivery
          if (typeof info.playerState === "number") {
            if (info.playerState === 0) { triggerEnded(); return; }
            setPlaying(info.playerState === 1);
          }

          // Duração
          if (typeof info.duration === "number" && info.duration > 0) {
            setDuration(info.duration);
          }

          // Tempo atual → calcula restante
          if (typeof info.currentTime === "number") {
            setDuration(prev => {
              if (prev && prev > 0) {
                setTimeRemaining(Math.max(0, prev - info.currentTime));
              }
              return prev;
            });
          }
        }

        // Resposta direta de getDuration (alguns embeds)
        if (typeof data.info === "number" && data.event === "getDuration") {
          setDuration(data.info);
        }
      } catch {}
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [src]);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black" onClick={() => setShowSpeedMenu(false)}>
      <iframe
        key={embedSrc}
        ref={iframeRef}
        src={embedSrc}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
        title="YouTube video"
        onLoad={handleIframeLoad}
      />

      {/* ══ OVERLAYS — escondem elementos nativos do YouTube ══════════════════ */}

      {/* TOPO: cobre título do vídeo + ícones de volume/CC/configurações */}
      <div className="absolute top-0 left-0 right-0 h-[18%] bg-black pointer-events-none" />

      {/* MEIO-INFERIOR: cobre a barra de progresso nativa (tempo + seek + botão minimizar) */}
      {/* Essa faixa fica logo acima do rodapé, cobrindo os controles nativos do YouTube */}
      <div className="absolute bottom-[38px] left-0 right-0 h-[14%] bg-black pointer-events-none" />

      {/* CANTO INFERIOR DIREITO: cobre botão de minimizar/redimensionar nativo */}
      <div className="absolute bottom-[38px] right-0 w-[10%] h-[10%] bg-black pointer-events-none" />

      {/* ── HUD: tempo restante + velocidade + tela cheia (altura fixa 38px) ── */}
      <div className="absolute bottom-0 left-0 right-0 h-[38px] flex items-center justify-between px-3 bg-black pointer-events-none">

        {/* Tempo restante */}
        <div className="flex items-center gap-1.5 pointer-events-none">
          {timeRemaining !== null ? (
            <span className="text-white text-xs font-mono font-medium bg-black/50 px-2 py-0.5 rounded">
              ⏱ {formatSeconds(timeRemaining)} restantes
            </span>
          ) : (
            <span className="text-white/40 text-[10px] font-mono">Carregando...</span>
          )}
        </div>

        {/* Velocidade + Tela cheia */}
        <div className="flex items-center gap-2 pointer-events-auto">

          {/* Seletor de velocidade */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(v => !v); }}
              className="text-white text-[11px] font-bold bg-black/60 hover:bg-black/80 px-2.5 py-1 rounded transition-colors"
              title="Velocidade de reprodução"
            >
              {speed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-8 right-0 bg-black/90 rounded-lg overflow-hidden shadow-xl border border-white/10 z-10">
                {speeds.map(s => (
                  <button key={s} onClick={(e) => { e.stopPropagation(); setPlaybackRate(s); }}
                    className={`block w-full text-left px-4 py-1.5 text-xs font-medium transition-colors
                      ${speed === s ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                    {s}x {s === 1 ? "(normal)" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tela cheia */}
          <button
            onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
            className="text-white text-[10px] font-medium bg-black/60 hover:bg-black/80 px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
            title="Tela cheia"
          >
            <Maximize2 className="w-3 h-3" /> Tela cheia
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Native Video Player — sem controles, apenas play/pause e tela cheia ───────

const RestrictedVideoPlayer = ({ src, onEnded }: { src: string; onEnded: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black cursor-pointer" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onEnded={() => { setPlaying(false); onEnded(); }}
        playsInline
        preload="auto"
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-full p-4">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}
      <button
        onClick={handleFullscreen}
        className="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-black transition-colors"
        title="Tela cheia"
      >
        <Maximize2 className="w-3 h-3" /> Tela cheia
      </button>
    </div>
  );
};
