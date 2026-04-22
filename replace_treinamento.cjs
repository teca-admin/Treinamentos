const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'components', 'TreinamentoModule.tsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Update states
code = code.replace(
  /const \[formData, setFormData\] = useState\(\{[\s\S]*?\}\);/,
  `const [formData, setFormData] = useState({ 
    nome: "", 
    descricao: "",
    data_inicio: new Date().toISOString().split('T')[0], 
    data_fim: "",
    capa_url: ""
  });`
);

code = code.replace(
  /const \[videoData, setVideoData\] = useState\(\{ titulo: "", url_video: "" \}\);/,
  `const [videoData, setVideoData] = useState<{titulo: string, url_video: string, tipo: 'youtube' | 'upload', file: File | null}>({ titulo: "", url_video: "", tipo: 'youtube', file: null });
  const [timeline, setTimeline] = useState<any[]>([]);`
);

// 2. Update manageContent
code = code.replace(
  /const manageContent = async \(curso: any\) => \{[\s\S]*?setShowForm\(true\);\n    \} catch \(error\) \{/m,
  `const manageContent = async (curso: any) => {
    setIsManageLoading(curso.id);
    try {
      setCreatedCursoId(curso.id);
      setFormData({
        nome: curso.nome,
        descricao: curso.descricao || "",
        data_inicio: curso.data_inicio || new Date().toISOString().split('T')[0],
        data_fim: curso.data_fim || "",
        capa_url: curso.capa_url || ""
      });
      
      const res = await fetch(\`/api/cursos/\${curso.id}/conteudo?contrato=\${currentContract}\`);
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
      
      try {
        if (curso.descricao && curso.descricao.startsWith('[')) {
          const parsed = JSON.parse(curso.descricao);
          setTimeline(parsed);
        } else {
          const fallback = [
            ...(data.conteudos || []).map((c: any) => ({ id: Date.now() + Math.random(), type: 'video', refId: c.id, label: c.titulo })),
            ...(data.questoes || []).map((q: any) => ({ id: Date.now() + Math.random(), type: 'questao', refId: q.id, label: q.enunciado }))
          ];
          setTimeline(fallback);
        }
      } catch (e) {
        const fallback = [
          ...(data.conteudos || []).map((c: any) => ({ id: Date.now() + Math.random(), type: 'video', refId: c.id, label: c.titulo })),
          ...(data.questoes || []).map((q: any) => ({ id: Date.now() + Math.random(), type: 'questao', refId: q.id, label: q.enunciado }))
        ];
        setTimeline(fallback);
      }
      
      setStep(1);
      setShowForm(true);
    } catch (error) {`
);

// 3. Update addVideo
code = code.replace(
  /const addVideo = async \(\) => \{[\s\S]*?\}\n  \};/m,
  `const addVideo = async () => {
    if (!videoData.titulo) {
      alert("Por favor, insira um título para o vídeo.");
      return;
    }
    if (videoData.tipo === 'youtube' && !videoData.url_video) {
      alert("Por favor, insira o link do YouTube.");
      return;
    }
    if (videoData.tipo === 'upload' && !videoData.file) {
      alert("Por favor, selecione um arquivo de vídeo.");
      return;
    }
    
    setIsVideoLoading(true);
    try {
      let finalUrl = videoData.url_video;
      
      if (videoData.tipo === 'upload' && videoData.file) {
        if (!supabaseClient) throw new Error("Supabase client not initialized");
        
        const fileExt = videoData.file.type.split('/')[1] || 'mp4';
        const fileName = \`\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${fileExt}\`;
        
        let bucketName = 'videos';
        let uploadResult = await supabaseClient.storage.from(bucketName).upload(fileName, videoData.file);
        
        if (uploadResult.error) {
           console.log("Erro ao subir no bucket 'videos', tentando 'treinamentos'...");
           bucketName = 'treinamentos';
           uploadResult = await supabaseClient.storage.from(bucketName).upload(fileName, videoData.file);
        }

        if (uploadResult.error) {
          throw new Error(\`Erro no upload para o Storage: \${uploadResult.error.message}\`);
        }
        
        const { data: { publicUrl } } = supabaseClient.storage.from(bucketName).getPublicUrl(uploadResult.data.path);
        finalUrl = publicUrl;
      }

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
        const newId = Date.now();
        setConteudos([...conteudos, { ...videoData, url_video: finalUrl, id: newId }]);
        setTimeline([...timeline, { id: Date.now() + Math.random(), type: 'video', refId: newId, label: videoData.titulo }]);
        setVideoData({ titulo: "", url_video: "", tipo: "youtube", file: null });
      } else {
        const data = await res.json();
        throw new Error(data.message || "Erro ao salvar no banco de dados");
      }
    } catch (error: any) {
      alert(\`Erro ao processar vídeo: \${error.message}\`);
    } finally {
      setIsVideoLoading(false);
    }
  };`
);

// 4. Update deleteVideo, addQuestao, deleteQuestao
code = code.replace(
  /const deleteVideo = async \(id: number\) => \{[\s\S]*?\};\n\n  const deleteQuestao = \(id: number\) => \{[\s\S]*?\};\n\n  const addQuestao = \(\) => \{[\s\S]*?\};/m,
  `const deleteVideo = async (id: number) => {
    if (!confirm("Deseja remover este vídeo?")) return;
    const previous = [...conteudos];
    setConteudos(conteudos.filter(c => c.id !== id));
    setTimeline(timeline.filter(t => !(t.type === 'video' && t.refId === id)));
    const res = await fetch(\`/api/cursos/conteudo/\${id}?contrato=\${currentContract}\`, { method: "DELETE" });
    if (!res.ok) setConteudos(previous);
  };

  const deleteQuestao = (id: number) => {
    setQuestoes(questoes.filter(q => q.id !== id));
    setTimeline(timeline.filter(t => !(t.type === 'questao' && t.refId === id)));
  };

  const addQuestao = () => {
    if (!novaQuestao.enunciado) return;
    const newId = Date.now();
    setQuestoes([...questoes, { ...novaQuestao, id: newId }]);
    setTimeline([...timeline, { id: Date.now() + Math.random(), type: 'questao', refId: newId, label: novaQuestao.enunciado }]);
    setNovaQuestao({ enunciado: "", opcoes: [
      { texto: "", correta: true },
      { texto: "", correta: false },
      { texto: "", correta: false },
      { texto: "", correta: false }
    ]});
  };`
);

// 5. Update saveAvaliacao
code = code.replace(
  /const saveAvaliacao = async \(\) => \{[\s\S]*?\}\n  \};/m,
  `const saveAvaliacao = async () => {
    if (timeline.length === 0) {
      alert("Adicione pelo menos um item à trilha.");
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
    
    if (!res.ok) {
      const data = await res.json();
      alert("Erro ao salvar: " + data.message);
      return;
    }
    
    const resCurso = await fetch(\`/api/cursos/\${createdCursoId}?contrato=\${currentContract}\`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        descricao: JSON.stringify(timeline)
      }),
    });

    if (resCurso.ok) {
      setShowSuccess(true);
      load();
    } else {
      alert("Erro ao salvar trilha.");
    }
  };`
);

// 6. Update step 2 UI rendering
const oldStep2HTML = `<div className="space-y-8">
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
                              placeholder={\`Opção \${idx + 1}\`} 
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
                </div>`;

const newStep2HTML = `<div className="space-y-8">
                  {/* Global Course Evaluation Settings */}
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-slate-800 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-wfs-accent" /> Configurações de Avaliação Global</h4>
                      <p className="text-[10px] text-slate-500 mt-1">A nota será baseada em todas as atividades respondidas na trilha.</p>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 block mb-1">Nota Mínima (%)</label>
                        <input type="number" className="input-field text-sm w-24" value={avaliacaoData.nota_minima} onChange={e => setAvaliacaoData({...avaliacaoData, nota_minima: parseInt(e.target.value)})} />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 block mb-1">Tentativas</label>
                        <input type="number" className="input-field text-sm w-24" value={avaliacaoData.tentativas_maximas} onChange={e => setAvaliacaoData({...avaliacaoData, tentativas_maximas: parseInt(e.target.value)})} />
                      </div>
                    </div>
                  </div>

                  {/* Add Content Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-6">
                    {/* Add Video */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-slate-800 flex items-center gap-2"><Video className="w-4 h-4 text-wfs-accent" /> Adicionar Vídeo à Trilha</h4>
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 block mb-1">Título do Vídeo</label>
                        <input placeholder="Ex: Introdução ao Sistema" className="input-field text-sm" value={videoData.titulo} onChange={e => setVideoData({...videoData, titulo: e.target.value})} />
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="radio" checked={videoData.tipo === 'youtube'} onChange={() => setVideoData({...videoData, tipo: 'youtube', url_video: '', file: null})} className="accent-wfs-accent" /> YouTube Link</label>
                        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="radio" checked={videoData.tipo === 'upload'} onChange={() => setVideoData({...videoData, tipo: 'upload', url_video: '', file: null})} className="accent-wfs-accent" /> Upload Arquivo</label>
                      </div>
                      {videoData.tipo === 'youtube' ? (
                        <div>
                          <label className="text-[10px] font-medium text-slate-400 block mb-1">Link do YouTube</label>
                          <input placeholder="https://youtube.com/..." className="input-field text-sm" value={videoData.url_video} onChange={e => setVideoData({...videoData, url_video: e.target.value})} />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] font-medium text-slate-400 block mb-1">Arquivo de Vídeo (Máx 20MB)</label>
                          <input type="file" accept="video/mp4,video/x-m4v,video/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-wfs-accent hover:file:bg-slate-100" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 20 * 1024 * 1024) { alert("Arquivo muito grande!"); return; }
                              setVideoData({...videoData, file, url_video: URL.createObjectURL(file), titulo: videoData.titulo || file.name});
                            }
                          }} />
                        </div>
                      )}
                      <button onClick={addVideo} disabled={isVideoLoading} className="w-full btn-primary h-10 px-4 flex items-center justify-center gap-2 disabled:opacity-50">
                        {isVideoLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                        <span className="text-xs font-medium">Adicionar Vídeo</span>
                      </button>
                    </div>

                    {/* Add Question */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-slate-800 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-wfs-accent" /> Adicionar Atividade à Trilha</h4>
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 block mb-1">Enunciado da Questão</label>
                        <input placeholder="Digite a pergunta..." className="input-field text-sm" value={novaQuestao.enunciado} onChange={e => setNovaQuestao({...novaQuestao, enunciado: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        {novaQuestao.opcoes.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input type="radio" name="correta_new" checked={opt.correta} onChange={() => {
                              const newOpts = novaQuestao.opcoes.map((o, i) => ({ ...o, correta: i === idx }));
                              setNovaQuestao({ ...novaQuestao, opcoes: newOpts });
                            }} className="accent-wfs-accent" />
                            <input placeholder={\`Opção \${idx + 1}\`} className="input-field text-xs py-1.5" value={opt.texto} onChange={e => {
                              const newOpts = [...novaQuestao.opcoes];
                              newOpts[idx].texto = e.target.value;
                              setNovaQuestao({ ...novaQuestao, opcoes: newOpts });
                            }} />
                          </div>
                        ))}
                      </div>
                      <button onClick={addQuestao} className="w-full btn-primary h-10 px-4 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> <span className="text-xs font-medium">Adicionar Questão</span>
                      </button>
                    </div>
                  </div>

                  {/* Timeline Render */}
                  <section className="space-y-4">
                    <h4 className="text-sm font-medium text-slate-800 flex items-center gap-2">
                      Timeline do Curso ({timeline.length} itens)
                    </h4>
                    <div className="space-y-2 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                      {timeline.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Nenhum conteúdo adicionado. Adicione vídeos e atividades acima.</p>}
                      {timeline.map((item, index) => (
                        <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            {item.type === 'video' ? <Video className="w-4 h-4" /> : <ClipboardList className="w-4 h-4 text-wfs-accent" />}
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
                            <div className="truncate">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Passo {index + 1} - {item.type === 'video' ? 'Vídeo' : 'Atividade'}</span>
                              <span className="text-sm font-medium text-slate-700 truncate block" title={item.label}>{item.label}</span>
                            </div>
                            <button onClick={() => item.type === 'video' ? deleteVideo(item.refId) : deleteQuestao(item.refId)} className="text-slate-300 hover:text-red-500 ml-2 shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <button onClick={() => setStep(1)} className="px-4 py-2 text-slate-500 font-medium text-xs hover:text-slate-700 transition-colors">Voltar</button>
                    <button onClick={saveAvaliacao} className="btn-primary flex items-center gap-2 px-8">
                      Finalizar e Publicar <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>`;

code = code.replace(oldStep2HTML, newStep2HTML);

// 7. Remove modal state resets
code = code.replace(
  /setConteudos\(\[\]\);\n    setQuestoes\(\[\]\);/,
  `setConteudos([]);
    setQuestoes([]);
    setTimeline([]);`
);

fs.writeFileSync(file, code);
console.log('Success');
