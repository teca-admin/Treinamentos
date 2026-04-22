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

// ── Component ──────────────────────────────────────────────────────────────────

export const EmployeePortal = ({ onExit }: { onExit?: () => void }) => {
  const [step, setStep] = useState(1);
  const [matricula, setMatricula] = useState("");
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

  // ── Logout ────────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setEmployee(null); setStep(1); setMatricula(""); setTurno("");
    setSelectedCurso(null); setContent(null); setResult(null);
    setItems([]); setAnswers({}); setCurrentItemIndex(0);
  };

  // ── Login ─────────────────────────────────────────────────────────────────────
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!matricula) return;
    if (!turno) { alert("Selecione seu turno para continuar."); return; }
    setIsLoginLoading(true);
    try {
      const res = await fetch("/api/funcionarios/matricula/" + matricula);
      const data = await res.json();
      if (data.success && data.funcionario) {
        const emp = data.funcionario;
        setEmployee(emp);
        const [rres, cres] = await Promise.all([
          fetch(`/api/treinamentos/resultados?funcionario_id=${emp.id}`),
          fetch("/api/cursos"),
        ]);
        const rdata = await rres.json();
        const cdata = await cres.json();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const processed = cdata.map((c: any) => {
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
      } else { alert("Matrícula não encontrada"); }
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
      const isReturning = curso.reprovadoCount > 0 || curso.isApproved;

      conteudos.forEach((v) => {
        built.push({ type: "video", data: v, videoId: v.id });
        const linked = questoes.filter((q) => q.conteudo_id === v.id);
        linked.forEach((q) => built.push({ type: "question", data: q, videoId: v.id }));
      });
      const unlinked = questoes.filter((q) => !q.conteudo_id);
      unlinked.forEach((q) => built.push({ type: "question", data: q, videoId: null }));

      setItems(built);
      setCurrentItemIndex(0);
      setAnswers({});
      setWatchedCurrent(isReturning);
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

  const handleSelectOption = (questionId: number, optionId: number) => {
    if (activityAnswered) return;
    setSelectedOption(optionId);
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
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
        questoes.forEach((q) => {
          const correctOpt = q.opcoes.find((o) => o.correta === true || o.correta === 1);
          if (correctOpt && answers[q.id] === correctOpt.id) score += 100 / questoes.length;
        });
      } else { score = 100; }

      const res = await fetch("/api/treinamentos/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionario_id: employee.id, curso_id: selectedCurso.id, nota: score, turno }),
      });
      const data = await res.json();
      setResult({ score, status: data.status });

      setCursos((prev) => prev.map((c) => {
        if (c.id !== selectedCurso.id) return c;
        const isApproved = c.isApproved || data.status === "Aprovado";
        const reprovadoCount = c.reprovadoCount + (data.status === "Reprovado" ? 1 : 0);
        const attemptsExceeded = reprovadoCount >= 3;
        const isBlocked = isApproved || attemptsExceeded;
        const blockReason = isApproved ? "Treinamento Concluído" : attemptsExceeded ? "Limite de tentativas excedido (3)" : c.blockReason;
        return { ...c, isApproved, reprovadoCount, isBlocked, blockReason };
      }));

      setStep(4);
    } catch { alert("Erro ao enviar avaliação. Verifique sua conexão."); }
    finally { setIsExamLoading(false); }
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
                <p className="text-[9px] opacity-60">{employee.matricula} · {turno}</p>
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
                  <label className="text-xs font-medium text-slate-500 block mb-1">Matrícula</label>
                  <input className="input-field text-center text-xl font-mono" value={matricula}
                    onChange={(e) => setMatricula(e.target.value)} placeholder="000000" required autoFocus />
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
                <button type="submit" disabled={isLoginLoading || !turno || !matricula}
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
                      <YoutubePlayer src={currentItem.data.url_video} onEnded={() => setWatchedCurrent(true)} />
                    ) : (
                      <RestrictedVideoPlayer src={currentItem.data.url_video} onEnded={() => setWatchedCurrent(true)} />
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
                            ${activityAnswered
                              ? isSelected ? "border-wfs-accent bg-red-50 font-medium" : "opacity-50 border-slate-200"
                              : isSelected ? "border-wfs-accent bg-red-50" : "hover:bg-slate-50 border-slate-200"}`}>
                          <input type="radio" name={`q-${currentItem.data.id}`} checked={isSelected}
                            onChange={() => !activityAnswered && handleSelectOption(currentItem.data.id, opt.id)}
                            className="accent-wfs-accent" />
                          <span className="text-sm">{opt.texto}</span>
                        </label>
                      );
                    })}
                  </div>

                  {activityAnswered && (
                    <div className="pt-2">
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
            const attemptsLeft = 3 - (currentCurso?.reprovadoCount || 0);
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
                      Tentativa {currentCurso?.reprovadoCount || 0} de 3
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
                    <button onClick={() => startCurso(selectedCurso)}
                      className="w-full max-w-xs bg-wfs-accent hover:bg-red-700 text-white py-4 rounded font-medium text-xs tracking-[0.2em] transition-all shadow-lg">
                      Tentar Novamente
                    </button>
                  ) : (
                    <button onClick={() => setStep(2)}
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
        </div>
      </div>
    </div>
  );
};

// ── YouTube Player — controles restritos, apenas tela cheia customizada ────────

const YoutubePlayer = ({ src, onEnded }: { src: string; onEnded: () => void }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const endedRef = useRef(false);

  const embedSrc = (() => {
    try {
      const u = new URL(src);
      if (u.pathname.startsWith("/embed/")) {
        u.searchParams.set("enablejsapi", "1");
        u.searchParams.set("origin", window.location.origin);
        u.searchParams.set("controls", "0");
        u.searchParams.set("disablekb", "1");
        u.searchParams.set("modestbranding", "1");
        u.searchParams.set("rel", "0");
        u.searchParams.set("iv_load_policy", "3");
        u.searchParams.set("fs", "0");
        return u.toString();
      }
    } catch {}
    return src;
  })();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "onStateChange" && data?.info === 0 && !endedRef.current) {
          endedRef.current = true;
          onEnded();
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onEnded]);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <iframe
        ref={iframeRef}
        src={embedSrc}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
        title="YouTube video"
      />
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
