import React, { useState } from "react";
import { ChevronRight, Video, ClipboardList, ArrowLeft, CheckCircle, AlertCircle, Lock, LogOut, Search, Filter } from "lucide-react";
import { motion } from "motion/react";

export const EmployeePortal = ({ onExit }: { onExit?: () => void }) => {
  const [step, setStep] = useState(1);
  const [matricula, setMatricula] = useState("");
  const [employee, setEmployee] = useState<any>(null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [employeeResults, setEmployeeResults] = useState<any[]>([]);
  const [selectedCurso, setSelectedCurso] = useState<any>(null);
  const [content, setContent] = useState<any>(null);
  const [watchedVideos, setWatchedVideos] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<any>({});
  const [result, setResult] = useState<any>(null);
  const [isExamLoading, setIsExamLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isCursoLoading, setIsCursoLoading] = useState(false);

  const handleLogout = () => {
    setEmployee(null);
    setStep(1);
    setMatricula("");
    setSelectedCurso(null);
    setContent(null);
    setResult(null);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!matricula) return;
    
    setIsLoginLoading(true);
    try {
      const res = await fetch("/api/funcionarios/matricula/" + matricula);
      const data = await res.json();
      if (data.success && data.funcionario) {
        const emp = data.funcionario;
        setEmployee(emp);
        
        const [rres, cres] = await Promise.all([
          fetch(`/api/treinamentos/resultados?funcionario_id=${emp.id}`),
          fetch("/api/cursos")
        ]);
        const rdata = await rres.json();
        const cdata = await cres.json();
        
        setEmployeeResults(rdata);
        
        // Mark courses as blocked if outside date range or attempts exceeded
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const processedCursos = cdata.map((c: any) => {
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
          
          return {
            ...c,
            isBlocked,
            blockReason,
            isApproved,
            reprovadoCount
          };
        });
        
        setCursos(processedCursos);
        setStep(2);
      } else {
        alert("Matrícula não encontrada");
      }
    } catch (err) {
      alert("Erro ao acessar o portal. Tente novamente.");
    } finally {
      setIsLoginLoading(false);
    }
  };

  const startCurso = async (curso: any) => {
    setIsCursoLoading(true);
    try {
      setSelectedCurso(curso);
      const res = await fetch(`/api/cursos/${curso.id}/conteudo`);
      const data = await res.json();
      setContent(data);
      
      // If user has already had an attempt or is approved, mark all videos as watched
      if (curso.reprovadoCount > 0 || curso.isApproved) {
        const allVideoIds = data.conteudos.map((c: any) => c.id);
        setWatchedVideos(new Set(allVideoIds));
      } else {
        setWatchedVideos(new Set());
      }
      
      setAnswers({});
      setStep(3);
    } catch (err) {
      alert("Erro ao carregar conteúdo do curso.");
    } finally {
      setIsCursoLoading(false);
    }
  };

  const markAsWatched = (videoId: number) => {
    setWatchedVideos(prev => {
      const next = new Set(prev);
      next.add(videoId);
      return next;
    });
  };

  const progress = content?.conteudos?.length > 0 
    ? (watchedVideos.size / content.conteudos.length) * 100 
    : 0;

  const currentCursoInState = cursos.find(c => c.id === selectedCurso?.id);
  const isExamUnlocked = progress >= 100 || (currentCursoInState?.reprovadoCount > 0) || currentCursoInState?.isApproved;

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && step === 3) {
        alert("Você saiu da tela do curso! Por segurança e para garantir o aprendizado, o curso será reiniciado.");
        setStep(2);
        setSelectedCurso(null);
        setContent(null);
        setWatchedVideos(new Set());
        setAnswers({});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [step]);

  const submitExam = async () => {
    if (Object.keys(answers).length < content.questoes.length) {
      alert("Por favor, responda todas as questões antes de finalizar.");
      return;
    }

    setIsExamLoading(true);
    try {
      let score = 0;
      content.questoes.forEach((q: any) => {
        const correctOpt = q.opcoes.find((o: any) => o.correta === true || o.correta === 1);
        if (answers[q.id] === correctOpt.id) score += (100 / content.questoes.length);
      });

      const res = await fetch("/api/treinamentos/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionario_id: employee.id, curso_id: selectedCurso.id, nota: score }),
      });
      const data = await res.json();
      setResult({ score, status: data.status });

      // Update local cursos state to reflect the new attempt
      setCursos(prev => prev.map(c => {
        if (c.id === selectedCurso.id) {
          const isApproved = c.isApproved || data.status === "Aprovado";
          const reprovadoCount = c.reprovadoCount + (data.status === "Reprovado" ? 1 : 0);
          const attemptsExceeded = reprovadoCount >= 3;
          
          let isBlocked = c.isBlocked;
          let blockReason = c.blockReason;
          
          if (isApproved) {
            isBlocked = true;
            blockReason = "Treinamento Concluído";
          } else if (attemptsExceeded) {
            isBlocked = true;
            blockReason = "Limite de tentativas excedido (3)";
          }

          return { ...c, isApproved, reprovadoCount, isBlocked, blockReason };
        }
        return c;
      }));

      setStep(4);
    } catch (err) {
      alert("Erro ao enviar avaliação. Verifique sua conexão.");
    } finally {
      setIsExamLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-wfs-bg flex flex-col">
      <div className="flex-1 bg-wfs-bg overflow-hidden flex flex-col">
        <div className="bg-wfs-accent py-3 px-6 text-white flex justify-between items-center sticky top-0 z-10 shadow-md">
          <div className="flex items-center gap-4">
            {(!employee && step !== 1 && onExit) && (
              <button onClick={onExit} className="p-1.5 hover:bg-white/10 rounded-full transition-colors" title="Voltar ao Sistema">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-lg font-medium tracking-tighter leading-tight">WFS Treinamentos</h1>
              <p className="text-[8px]  tracking-widest opacity-60">Ambiente do Colaborador</p>
            </div>
          </div>
          {employee && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-medium">{employee.nome}</p>
                <p className="text-[9px] opacity-60">{employee.matricula}</p>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-all" title="Sair">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm mx-auto space-y-6 bg-white p-8 rounded-2xl shadow-xl mt-20">
              <h2 className="text-xl font-medium text-center text-slate-800">Acesse seus Treinamentos</h2>
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="text-xs font-medium  text-slate-500">Matrícula</label>
                  <input 
                    className="input-field text-center text-xl font-mono" 
                    value={matricula} 
                    onChange={e => setMatricula(e.target.value)} 
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={isLoginLoading} className="btn-primary w-full py-4 font-medium  tracking-widest disabled:opacity-50">
                  {isLoginLoading ? "Acessando..." : "Entrar no Portal"}
                </button>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto w-full space-y-6">
              <h2 className="text-lg font-medium  text-slate-700 border-b pb-4 mb-6">Seus Cursos Disponíveis</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {cursos.map(c => (
                  <div 
                    key={c.id} 
                    className={`card transition-all overflow-hidden p-0 flex flex-col ${c.isBlocked ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-wfs-accent cursor-pointer group'}`} 
                    onClick={() => !c.isBlocked && startCurso(c)}
                  >
                    <div className="aspect-video bg-slate-100 relative">
                      {c.capa_url ? (
                        <img src={c.capa_url} alt={c.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Video className="w-6 h-6" />
                        </div>
                      )}
                      {c.isBlocked && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="bg-white/90 px-3 py-1 rounded-full flex items-center gap-2">
                            <Lock className="w-3 h-3 text-red-600" />
                            <span className="text-[10px] font-medium  text-red-600 tracking-wider">Bloqueado</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-medium ${!c.isBlocked && 'group-hover:text-wfs-accent'} transition-colors`}>{c.nome}</h3>
                        {c.isApproved && (
                          <span className="bg-green-100 text-green-700 text-[8px] font-medium px-1.5 py-0.5 rounded ">Aprovado</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4">
                        <div className={`flex items-center text-[10px] font-medium  gap-1 ${c.isBlocked ? 'text-slate-400' : 'text-wfs-accent'}`}>
                          {isCursoLoading && selectedCurso?.id === c.id ? (
                            <div className="w-3 h-3 border-2 border-wfs-accent/30 border-t-wfs-accent rounded-full animate-spin mr-1" />
                          ) : null}
                          {c.isBlocked ? c.blockReason : (c.isApproved ? 'Refazer Treinamento' : 'Iniciar Treinamento')} {!c.isBlocked && <ChevronRight className="w-3 h-3" />}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 font-medium ">
                            Até {c.data_fim ? new Date(c.data_fim).toLocaleDateString() : '-'}
                          </p>
                          {!c.isApproved && (
                            <p className="text-[9px] text-slate-400 font-medium ">
                              Tentativas: {c.reprovadoCount}/3
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && content && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto w-full space-y-8">
              <div className="flex items-center gap-2 text-slate-400 mb-4 cursor-pointer hover:text-slate-600" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" /> <span className="text-xs font-medium ">Voltar</span>
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <h2 className="text-2xl font-medium text-wfs-text">{selectedCurso.nome}</h2>
                  <div className="text-right">
                    <p className="text-[10px] font-medium  text-slate-400 mb-1">Progresso do Conteúdo</p>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-green-500"
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{progress.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                
                {content.conteudos.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium  text-slate-500 flex items-center gap-2">
                      <Video className="w-4 h-4" /> Conteúdo em Vídeo
                    </h3>
                    {content.conteudos.map((c: any) => (
                      <div key={c.id} className="space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-medium text-slate-500  tracking-wider">{c.titulo}</p>
                          {watchedVideos.has(c.id) && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 ">
                              <CheckCircle className="w-3 h-3" /> Concluído
                            </span>
                          )}
                        </div>
                        <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
                          <video 
                            key={c.id}
                            src={c.url_video} 
                            controls 
                            className="w-full h-full object-contain"
                            controlsList="nodownload"
                            playsInline
                            preload="auto"
                            onEnded={() => markAsWatched(c.id)}
                          >
                            Seu navegador não suporta a tag de vídeo.
                          </video>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {content.avaliacao && (
                  <div className="space-y-6 pt-8 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium  text-slate-500 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" /> Avaliação de Conhecimento
                      </h3>
                      {!isExamUnlocked && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-wfs-accent  bg-red-50 px-2 py-1 rounded">
                          <AlertCircle className="w-3 h-3" /> Assista todos os vídeos para liberar
                        </span>
                      )}
                    </div>

                    {isExamUnlocked ? (
                      <>
                        {content.questoes.map((q: any, i: number) => (
                          <div key={q.id} className="space-y-3">
                            <p className="font-medium text-slate-800">{i + 1}. {q.enunciado}</p>
                            <div className="space-y-2">
                              {q.opcoes.map((opt: any) => (
                                <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                  answers[q.id] === opt.id ? 'border-wfs-accent bg-red-50' : 'hover:bg-slate-50'
                                }`}>
                                  <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === opt.id} onChange={() => setAnswers({...answers, [q.id]: opt.id})} className="accent-wfs-accent" />
                                  <span className="text-sm">{opt.texto}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={submitExam} 
                          disabled={isExamLoading}
                          className="btn-primary w-full py-4 font-medium  tracking-widest mt-8 disabled:opacity-50"
                        >
                          {isExamLoading ? "Enviando..." : "Finalizar e Enviar Respostas"}
                        </button>
                      </>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center space-y-3">
                        <div className="w-12 h-12 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                          <ClipboardList className="w-6 h-6" />
                        </div>
                        <h4 className="font-medium text-slate-400  text-sm">Prova Bloqueada</h4>
                        <p className="text-xs text-slate-400">Você precisa assistir 100% dos vídeos do curso para liberar a avaliação final.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 4 && result && (() => {
            const currentCurso = cursos.find(c => c.id === selectedCurso.id);
            const attemptsLeft = 3 - (currentCurso?.reprovadoCount || 0);
            const canRetry = attemptsLeft > 0 && !currentCurso?.isApproved;

            return (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="max-w-2xl mx-auto py-16 px-8 bg-white border border-slate-200 shadow-sm rounded-lg text-center"
              >
                {result.status === "Aprovado" ? (
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-100">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-medium text-slate-900 tracking-tight ">Treinamento Concluído</h2>
                      <p className="text-slate-500 text-sm">Você atingiu a pontuação necessária para aprovação.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-red-50 text-wfs-accent rounded-full flex items-center justify-center mx-auto border border-red-100">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-medium text-slate-900 tracking-tight ">Desempenho Insuficiente</h2>
                      <p className="text-slate-500 text-sm">Sua pontuação foi inferior ao mínimo exigido para este módulo.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded text-[10px] font-medium text-slate-600  tracking-widest border border-slate-200">
                      Tentativa {(currentCurso?.reprovadoCount || 0)} de 3
                    </div>
                    {!canRetry && (
                      <p className="text-xs font-medium text-red-600  tracking-widest">Limite de tentativas excedido para este curso.</p>
                    )}
                  </div>
                )}

                <div className="my-10 py-8 border-y border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] font-medium  text-slate-400 tracking-[0.2em] mb-2">Pontuação Final</span>
                  <span className="text-7xl font-mono font-light text-slate-900 tracking-tighter">
                    {result.score.toFixed(0)}<span className="text-2xl text-slate-300 ml-1">%</span>
                  </span>
                </div>

                <div className="flex flex-col items-center gap-4">
                  {result.status === "Reprovado" && canRetry ? (
                    <button 
                      onClick={() => startCurso(selectedCurso)} 
                      className="w-full max-w-xs bg-wfs-accent hover:bg-red-700 text-white py-4 rounded font-medium  text-xs tracking-[0.2em] transition-all shadow-lg shadow-red-900/10"
                    >
                      Tentar Novamente
                    </button>
                  ) : (
                    <button 
                      onClick={() => setStep(2)} 
                      className="w-full max-w-xs bg-slate-900 hover:bg-slate-800 text-white py-4 rounded font-medium  text-xs tracking-[0.2em] transition-all"
                    >
                      Voltar para meus cursos
                    </button>
                  )}
                  
                  {result.status === "Aprovado" && (
                    <p className="text-[10px] text-slate-400  font-medium tracking-widest">O certificado será emitido automaticamente pelo RH.</p>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
