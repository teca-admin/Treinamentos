import express from "express";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase
const supabaseUrl = "https://teca-admin-supabase.ly7t0m.easypanel.host";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'nexus' }
});

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- API ROUTES ---

// AUTH
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  console.log(`Tentativa de login para o usuário: ${username}`);

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, message: "Erro de configuração no servidor (Supabase URL/Key faltando)" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error) {
      console.error("Erro no Supabase ao buscar usuário:", error.message);
      let friendlyMessage = `Erro no banco de dados: ${error.message}`;
      if (error.message.includes("fetch failed")) {
        friendlyMessage = "Não foi possível conectar ao servidor do Supabase. Verifique se ele está online.";
      } else if (error.code === "PGRST116") {
        friendlyMessage = "Usuário ou senha incorretos";
      }
      return res.status(401).json({ success: false, message: friendlyMessage });
    }

    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Credenciais inválidas" });
    }
  } catch (err: any) {
    console.error("Erro crítico no servidor durante o login:", err);
    res.status(500).json({ success: false, message: "Erro interno no servidor" });
  }
});

// PORTAL — Busca funcionário por matrícula (usado pelo EmployeePortal)
app.get("/api/funcionarios/matricula/:matricula", async (req, res) => {
  const { data: funcionario, error } = await supabase
    .from("funcionarios")
    .select("*")
    .eq("matricula", req.params.matricula)
    .single();

  if (error) {
    return res.status(404).json({ success: false, message: "Matrícula não encontrada" });
  }
  res.json({ success: true, funcionario });
});

// PORTAL — Busca funcionário por CPF (usado pelo EmployeePortal)
app.get("/api/funcionarios/cpf/:cpf", async (req, res) => {
  // Normaliza CPF removendo pontuação
  const cpfLimpo = req.params.cpf.replace(/[^0-9]/g, "");
  const { data: funcionario, error } = await supabase
    .from("funcionarios")
    .select("*")
    .eq("cpf", cpfLimpo)
    .single();

  if (error) {
    return res.status(404).json({ success: false, message: "CPF não encontrado" });
  }
  res.json({ success: true, funcionario });
});

// TREINAMENTO API

app.get("/api/cursos", async (req, res) => {
  const { contrato } = req.query;
  let query = supabase.from("cursos").select("*");
  if (contrato) query = query.eq("contrato", contrato);
  let { data: list, error } = await query;

  if (error && error.code === '42P01') {
    let queryT = supabase.from("treinamentos").select("*");
    if (contrato) queryT = queryT.eq("contrato", contrato);
    const result = await queryT;
    list = result.data;
  }

  res.json(list || []);
});

app.post("/api/cursos", async (req, res) => {
  const { nome, descricao, data_inicio, data_fim, capa_url, tipo_conteudo, responsavel, finalidade, assunto, publico_alvo, base, sumario } = req.body;
  const { contrato } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const payload = { nome, descricao: descricao || "", data_inicio, data_fim, obrigatorio: true, capa_url: capa_url || null, data_criacao: today, contrato: contrato || null, tipo_conteudo: tipo_conteudo || null, responsavel: responsavel || null, finalidade: finalidade || null, assunto: assunto || null, publico_alvo: publico_alvo || [], base: base || null, sumario: sumario || null };

  let { data, error } = await supabase.from("cursos").insert([payload]).select().single();

  if (error && error.code === '42P01') {
    const result = await supabase.from("treinamentos").insert([payload]).select().single();
    data = result.data;
    error = result.error;
  }

  res.json({ success: !error, id: data?.id });
});

app.put("/api/cursos/:id", async (req, res) => {
  const { nome, data_inicio, data_fim, capa_url, tipo_conteudo, responsavel, finalidade, assunto, publico_alvo, base, sumario } = req.body;
  const fields = { nome, data_inicio, data_fim, capa_url, tipo_conteudo: tipo_conteudo || null, responsavel: responsavel || null, finalidade: finalidade || null, assunto: assunto || null, publico_alvo: publico_alvo || [], base: base || null, sumario: sumario || null };
  let { error } = await supabase.from("cursos").update(fields).eq("id", req.params.id);

  if (error && error.code === '42P01') {
    const result = await supabase.from("treinamentos").update(fields).eq("id", req.params.id);
    error = result.error;
  }

  res.json({ success: !error });
});

app.get("/api/cursos/:id/conteudo", async (req, res) => {
  const [conteudosResult, avaliacaoResult] = await Promise.all([
    supabase.from("cursos_conteudos").select("*").eq("curso_id", req.params.id).order("ordem"),
    supabase.from("avaliacoes").select("*").eq("curso_id", req.params.id).single()
  ]);

  let conteudos = conteudosResult.data;
  if (conteudosResult.error && conteudosResult.error.code === '42P01') {
    const result = await supabase.from("treinamento_conteudos").select("*").eq("curso_id", req.params.id).order("ordem");
    conteudos = result.data;
  }

  const avaliacao = avaliacaoResult.data;

  let formattedQuestoes = [];
  if (avaliacao) {
    const { data: questoes } = await supabase.from("questoes").select("*").eq("avaliacao_id", avaliacao.id);
    if (questoes) {
      formattedQuestoes = await Promise.all(questoes.map(async (q: any) => {
        const { data: opcoes } = await supabase.from("opcoes").select("*").eq("questao_id", q.id);
        return { ...q, opcoes: opcoes || [] };
      }));
    }
  }
  res.json({ conteudos: conteudos || [], avaliacao, questoes: formattedQuestoes });
});

app.post("/api/cursos/conteudo", async (req, res) => {
  const { curso_id, titulo, url_video, ordem } = req.body;
  console.log(`Tentando salvar vídeo: ${titulo} para o curso ${curso_id}`);

  let { data: inserted, error } = await supabase.from("cursos_conteudos").insert([{ curso_id, titulo, url_video, ordem }]).select().single();

  if (error && error.code === '42P01') {
    console.log("Tabela 'cursos_conteudos' não encontrada, tentando 'treinamento_conteudos'...");
    const result = await supabase.from("treinamento_conteudos").insert([{ curso_id, titulo, url_video, ordem }]).select().single();
    inserted = result.data;
    error = result.error;
  }

  if (error) {
    console.error("Erro ao inserir conteúdo no Supabase:", error);
    return res.status(400).json({ success: false, message: error.message });
  }

  res.json({ success: true, id: inserted?.id });
});

app.delete("/api/cursos/conteudo/:id", async (req, res) => {
  let { error } = await supabase.from("cursos_conteudos").delete().eq("id", req.params.id);

  if (error && error.code === '42P01') {
    const result = await supabase.from("treinamento_conteudos").delete().eq("id", req.params.id);
    error = result.error;
  }

  res.json({ success: !error });
});

app.post("/api/cursos/avaliacao", async (req, res) => {
  const { curso_id, nota_minima, tentativas_maximas, questoes } = req.body;
  try {
    const { data: existing } = await supabase.from("avaliacoes").select("id").eq("curso_id", curso_id).single();
    if (existing) await supabase.from("avaliacoes").delete().eq("id", existing.id);

    const { data: aval, error: aErr } = await supabase.from("avaliacoes").insert([{ curso_id, nota_minima, tentativas_maximas }]).select().single();
    if (aErr) throw aErr;

    for (const q of questoes) {
      const questaoPayload: any = { avaliacao_id: aval.id, enunciado: q.enunciado };
      if (q.conteudo_id !== undefined && q.conteudo_id !== null) questaoPayload.conteudo_id = q.conteudo_id;
      const { data: quest, error: qErr } = await supabase.from("questoes").insert([questaoPayload]).select().single();
      if (qErr) throw qErr;
      const opcoesToInsert = q.opcoes.map((opt: any) => ({ questao_id: quest.id, texto: opt.texto, correta: opt.correta ? true : false }));
      await supabase.from("opcoes").insert(opcoesToInsert);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
});

app.post("/api/treinamentos/responder", async (req, res) => {
  const { funcionario_id, curso_id, nota, turno } = req.body;

  let { data: results, error: rErr } = await supabase.from("resultados_treinamento").select("status").eq("funcionario_id", funcionario_id).eq("curso_id", curso_id);

  if (rErr && rErr.code === '42P01') {
    const result = await supabase.from("treinamento_resultados").select("status").eq("funcionario_id", funcionario_id).eq("curso_id", curso_id);
    results = result.data;
  }

  const isApproved = results?.some((r: any) => r.status === "Aprovado");
  const reprovadoCount = results?.filter((r: any) => r.status === "Reprovado").length || 0;

  if (isApproved) return res.status(400).json({ success: false, message: "Você já foi aprovado neste curso." });
  if (reprovadoCount >= 3) return res.status(400).json({ success: false, message: "Limite de tentativas excedido (3)." });

  const { data: avaliacao } = await supabase.from("avaliacoes").select("*").eq("curso_id", curso_id).single();
  const status = nota >= (avaliacao?.nota_minima || 0) ? "Aprovado" : "Reprovado";
  const today = new Date().toISOString().split('T')[0];

  let { error } = await supabase.from("resultados_treinamento").insert([{ funcionario_id, curso_id, nota, status, data_conclusao: today, turno: turno || null }]);

  if (error && error.code === '42P01') {
    const result = await supabase.from("treinamento_resultados").insert([{ funcionario_id, curso_id, nota, status, data_conclusao: today, turno: turno || null }]);
    error = result.error;
  }

  res.json({ success: !error, status });
});

app.get("/api/treinamentos/resultados", async (req, res) => {
  const { contrato, funcionario_id } = req.query;
  let query = supabase
    .from("resultados_treinamento")
    .select(`id, nota, status, data_conclusao, curso_id, funcionario_id, funcionarios ( nome, matricula, cpf, cargo ), cursos ( nome )`)
    .order("id", { ascending: false });

  if (funcionario_id) query = query.eq("funcionario_id", funcionario_id);

  const { data: results } = await query;
  const processedResults = results?.map((r: any) => {
    const courseAttempts = results.filter((r2: any) => r2.funcionario_id === r.funcionario_id && r2.curso_id === r.curso_id && r2.id <= r.id);
    return {
      id: r.id,
      funcionario_nome: r.funcionarios?.nome || 'Deletado',
      matricula: String(r.funcionarios?.matricula || ''),
      curso_nome: r.cursos?.nome || 'Deletado',
      nota: r.nota,
      status: r.status,
      data_conclusao: r.data_conclusao,
      curso_id: r.curso_id,
      tentativa: courseAttempts.length
    };
  }) || [];
  res.json(processedResults);
});

app.get("/api/cursos/:id/participantes", async (req, res) => {
  let { data: results, error } = await supabase
    .from("resultados_treinamento")
    .select(`funcionario_id, funcionarios ( nome, matricula, cpf, cargo )`)
    .eq("curso_id", req.params.id);

  if (error && error.code === '42P01') {
    const r = await supabase
      .from("treinamento_resultados")
      .select(`funcionario_id, funcionarios ( nome, matricula, cpf, cargo )`)
      .eq("curso_id", req.params.id);
    results = r.data;
  }

  const seen = new Set<number>();
  const unique = (results || []).filter((r: any) => {
    if (seen.has(r.funcionario_id)) return false;
    seen.add(r.funcionario_id);
    return true;
  });

  const sorted = unique
    .map((r: any) => ({
      funcionario_id: r.funcionario_id,
      nome: r.funcionarios?.nome || '',
      matricula: String(r.funcionarios?.matricula || ''),
      cpf: r.funcionarios?.cpf || '',
      cargo: r.funcionarios?.cargo || '',
    }))
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));

  res.json(sorted);
});

// CONFIG
app.get("/api/config/supabase", (req, res) => {
  res.json({ url: supabaseUrl, key: supabaseKey });
});

// ── BASES ────────────────────────────────────────────────────────────────────
app.get("/api/bases", async (_req, res) => {
  const { data, error } = await supabase.from("bases").select("*").order("nome");
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json(data || []);
});

app.post("/api/bases", async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ success: false, message: "Nome obrigatório" });
  const { data, error } = await supabase.from("bases").insert([{ nome }]).select().single();
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, base: data });
});

// ── VÍDEOS ASSISTIDOS — marca/verifica vídeos já vistos por funcionário ────────
// Marca um vídeo como assistido
app.post("/api/videos-assistidos", async (req, res) => {
  const { funcionario_id, curso_id, conteudo_id } = req.body;
  if (!funcionario_id || !curso_id || !conteudo_id)
    return res.status(400).json({ success: false, message: "Parâmetros obrigatórios faltando" });

  // upsert — não duplica se já existir
  const { error } = await supabase.from("videos_assistidos")
    .upsert([{ funcionario_id, curso_id, conteudo_id }], { onConflict: "funcionario_id,curso_id,conteudo_id" });

  res.json({ success: !error });
});

// Retorna lista de conteudo_ids já assistidos pelo funcionário num curso
app.get("/api/videos-assistidos/:funcionario_id/:curso_id", async (req, res) => {
  const { funcionario_id, curso_id } = req.params;
  const { data, error } = await supabase.from("videos_assistidos")
    .select("conteudo_id")
    .eq("funcionario_id", funcionario_id)
    .eq("curso_id", curso_id);

  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ watched: (data || []).map((r: any) => r.conteudo_id) });
});

export default app;
