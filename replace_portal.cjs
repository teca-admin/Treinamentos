const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'components', 'EmployeePortal.tsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Add currentTimelineIndex state
code = code.replace(
  /const \[result, setResult\] = useState<any>\(null\);/,
  `const [result, setResult] = useState<any>(null);
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState(0);
  const [courseTimeline, setCourseTimeline] = useState<any[]>([]);`
);

// 2. Update handleLogout
code = code.replace(
  /setContent\(null\);\n    setResult\(null\);/,
  `setContent(null);
    setResult(null);
    setCurrentTimelineIndex(0);
    setCourseTimeline([]);`
);

// 3. Update startCurso to parse timeline
code = code.replace(
  /const startCurso = async \(curso: any\) => \{[\s\S]*?setAnswers\(\{\}\);\n      setStep\(3\);\n    \} catch \(err\) \{/m,
  `const startCurso = async (curso: any) => {
    setIsCursoLoading(true);
    try {
      setSelectedCurso(curso);
      const res = await fetch(\`/api/cursos/\${curso.id}/conteudo\`);
      const data = await res.json();
      setContent(data);
      
      let parsedTimeline = [];
      try {
        if (curso.descricao && curso.descricao.startsWith('[')) {
          parsedTimeline = JSON.parse(curso.descricao);
        } else {
          parsedTimeline = [
            ...(data.conteudos || []).map((c: any) => ({ id: Date.now() + Math.random(), type: 'video', refId: c.id, label: c.titulo })),
            ...(data.questoes || []).map((q: any) => ({ id: Date.now() + Math.random(), type: 'questao', refId: q.id, label: q.enunciado }))
          ];
        }
      } catch (e) {
        parsedTimeline = [
          ...(data.conteudos || []).map((c: any) => ({ id: Date.now() + Math.random(), type: 'video', refId: c.id, label: c.titulo })),
          ...(data.questoes || []).map((q: any) => ({ id: Date.now() + Math.random(), type: 'questao', refId: q.id, label: q.enunciado }))
        ];
      }
      setCourseTimeline(parsedTimeline);
      setCurrentTimelineIndex(0);

      if (curso.reprovadoCount > 0 || curso.isApproved) {
        const allVideoIds = data.conteudos.map((c: any) => c.id);
        setWatchedVideos(new Set(allVideoIds));
      } else {
        setWatchedVideos(new Set());
      }
      
      setAnswers({});
      setStep(3);
    } catch (err) {`
);

// 4. Update progress calculation
code = code.replace(
  /const progress = content\?.conteudos\?.length > 0 \n    \? \(watchedVideos.size \/ content.conteudos.length\) \* 100 \n    : 0;\n\n  const currentCursoInState = cursos.find\(c => c.id === selectedCurso\?.id\);\n  const isExamUnlocked = progress >= 100 \|\| \(currentCursoInState\?.reprovadoCount > 0\) \|\| currentCursoInState\?.isApproved;/,
  `const progress = courseTimeline.length > 0 
    ? (currentTimelineIndex / courseTimeline.length) * 100 
    : 0;

  const currentCursoInState = cursos.find(c => c.id === selectedCurso?.id);
  const isExamUnlocked = true; // No longer blocking exam as a separate section`
);

// 5. Replace step 3 HTML logic
const oldStep3Regex = /\{step === 3 && content && \([\s\S]*?\n          \)\}/m;

const newStep3HTML = `{step === 3 && content && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto w-full space-y-8">
              <div className="flex items-center gap-2 text-slate-400 mb-4 cursor-pointer hover:text-slate-600" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" /> <span className="text-xs font-medium ">Voltar</span>
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-end border-b pb-4">
                  <h2 className="text-2xl font-medium text-wfs-text">{selectedCurso.nome}</h2>
                  <div className="text-right">
                    <p className="text-[10px] font-medium  text-slate-400 mb-1">Progresso do Curso</p>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: \`\${Math.min(100, (currentTimelineIndex / Math.max(1, courseTimeline.length)) * 100)}%\` }}
                          className="h-full bg-wfs-accent"
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{Math.min(100, (currentTimelineIndex / Math.max(1, courseTimeline.length)) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                
                {(() => {
                  const currentItem = courseTimeline[currentTimelineIndex];
                  if (!currentItem) return <div className="text-center py-10">Treinamento Concluído! Aguarde...</div>;
                  
                  if (currentItem.type === 'video') {
                    const videoObj = content.conteudos.find((c: any) => c.id === currentItem.refId);
                    if (!videoObj) return <div>Vídeo não encontrado.</div>;
                    
                    const isYoutube = videoObj.url_video.includes("youtube.com") || videoObj.url_video.includes("youtu.be");
                    let youtubeId = "";
                    if (isYoutube) {
                      const regex = /(?:youtube\\.com\\/(?:[^/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)([^"&?\\/\\s]{11})/i;
                      const match = videoObj.url_video.match(regex);
                      if (match) youtubeId = match[1];
                    }
                    
                    return (
                      <motion.div key={currentItem.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div className="flex items-center gap-2 text-wfs-accent mb-2">
                          <Video className="w-5 h-5" />
                          <h3 className="text-lg font-medium">{videoObj.titulo}</h3>
                        </div>
                        <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 relative">
                          {isYoutube && youtubeId ? (
                            <iframe 
                              src={\`https://www.youtube.com/embed/\${youtubeId}?rel=0&modestbranding=1\`} 
                              className="w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                              allowFullScreen
                            ></iframe>
                          ) : (
                            <video 
                              src={videoObj.url_video} 
                              controls 
                              className="w-full h-full object-contain"
                              controlsList="nodownload"
                              playsInline
                              onEnded={() => markAsWatched(videoObj.id)}
                            >
                              Seu navegador não suporta a tag de vídeo.
                            </video>
                          )}
                        </div>
                        <div className="flex justify-end pt-4">
                          <button onClick={() => setCurrentTimelineIndex(i => i + 1)} className="btn-primary flex items-center gap-2 px-8 py-3">
                            Próxima Etapa <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  }
                  
                  if (currentItem.type === 'questao') {
                    const questaoObj = content.questoes.find((q: any) => q.id === currentItem.refId);
                    if (!questaoObj) return <div>Questão não encontrada.</div>;
                    
                    return (
                      <motion.div key={currentItem.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 max-w-3xl mx-auto py-8">
                        <div className="flex items-center gap-2 text-wfs-accent mb-6">
                          <ClipboardList className="w-5 h-5" />
                          <h3 className="text-sm font-medium tracking-widest uppercase">Atividade de Fixação</h3>
                        </div>
                        <p className="text-xl font-medium text-slate-800 leading-relaxed mb-8">{questaoObj.enunciado}</p>
                        <div className="space-y-3">
                          {questaoObj.opcoes.map((opt: any) => (
                            <label key={opt.id} className={\`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all \${
                              answers[questaoObj.id] === opt.id ? 'border-wfs-accent bg-red-50 text-red-900' : 'hover:border-slate-300 hover:bg-slate-50 border-slate-200'
                            }\`}>
                              <div className={\`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 \${answers[questaoObj.id] === opt.id ? 'border-wfs-accent' : 'border-slate-300'}\`}>
                                {answers[questaoObj.id] === opt.id && <div className="w-2.5 h-2.5 bg-wfs-accent rounded-full" />}
                              </div>
                              <span className="text-base font-medium">{opt.texto}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex justify-between pt-8 border-t mt-8">
                          <button onClick={() => setCurrentTimelineIndex(i => Math.max(0, i - 1))} className="px-6 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-lg transition-colors">
                            Voltar
                          </button>
                          {currentTimelineIndex === courseTimeline.length - 1 ? (
                            <button onClick={submitExam} disabled={isExamLoading} className="btn-primary flex items-center gap-2 px-8 py-3 disabled:opacity-50">
                              {isExamLoading ? "Enviando..." : "Finalizar Treinamento"}
                            </button>
                          ) : (
                            <button onClick={() => {
                              if (!answers[questaoObj.id]) {
                                alert("Por favor, selecione uma resposta antes de continuar.");
                                return;
                              }
                              setCurrentTimelineIndex(i => i + 1);
                            }} className="bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2 px-8 py-3 font-medium rounded transition-colors">
                              Continuar <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  }
                })()}
              </div>
            </motion.div>
          )}`;

code = code.replace(oldStep3Regex, newStep3HTML);

// 6. Update gabarito in step 4
const gabaritoRegex = /\{result.status === "Aprovado" && \(\n                    <p className="text-\[10px\] text-slate-400  font-medium tracking-widest">O certificado será emitido automaticamente pelo RH.<\/p>\n                  \)\}/m;

const gabaritoHTML = `{result.status === "Aprovado" && (
                    <div className="w-full text-left mt-8 pt-8 border-t border-slate-100">
                      <h3 className="text-lg font-medium text-slate-800 mb-6 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Gabarito do Treinamento</h3>
                      <div className="space-y-6">
                        {content?.questoes?.map((q: any, i: number) => {
                          const correctOpt = q.opcoes.find((o: any) => o.correta === true || o.correta === 1);
                          const userOptId = answers[q.id];
                          const isCorrect = userOptId === correctOpt?.id;
                          
                          return (
                            <div key={q.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <p className="font-medium text-slate-800 mb-3">{i + 1}. {q.enunciado}</p>
                              <div className="space-y-2">
                                {q.opcoes.map((opt: any) => {
                                  const isThisCorrect = opt.id === correctOpt?.id;
                                  const isThisSelected = opt.id === userOptId;
                                  
                                  let rowClass = "flex items-center gap-3 p-2 rounded-lg text-sm ";
                                  if (isThisCorrect) rowClass += "bg-green-100 text-green-800 border border-green-200 font-medium";
                                  else if (isThisSelected && !isThisCorrect) rowClass += "bg-red-100 text-red-800 border border-red-200";
                                  else rowClass += "text-slate-600";
                                  
                                  return (
                                    <div key={opt.id} className={rowClass}>
                                      {isThisCorrect ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> : (isThisSelected ? <X className="w-4 h-4 text-red-500 shrink-0" /> : <div className="w-4 h-4 shrink-0" />)}
                                      <span>{opt.texto}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}`;

code = code.replace(gabaritoRegex, gabaritoHTML);

fs.writeFileSync(file, code);
console.log('Success');
