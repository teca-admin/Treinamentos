import React, { useState, useEffect, useCallback } from "react";
import { BarChart2, Users, BookOpen, Star, RefreshCw, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { Contract } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseProgress {
  id: number;
  nome: string;
  publico_alvo: string[];
  data_inicio: string | null;
  data_fim: string | null;
  tipo_conteudo: string | null;
  totalEmployees: number;
  completed: number;
  pct: number;
}

interface SurveyResponse {
  curso_id: number;
  respostas: Record<string, number>;
}

interface DashboardData {
  courseProgress: CourseProgress[];
  surveys: SurveyResponse[];
  empCounts: { auxiliar: number; ope: number; analista: number; tst: number; lider: number };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const SURVEY_QUESTIONS = [
  "Conteúdo apresentado",
  "Clareza e facilidade de entendimento",
  "Domínio do instrutor",
  "Duração do treinamento",
  "Exemplos aplicáveis à operação",
  "Percepção de riscos aumentada",
  "Preparado para reportar incidentes",
  "Recursos utilizados (slides, imagens)",
  "Recomendaria o treinamento",
  "Satisfação geral",
];

// ── Componente Principal ──────────────────────────────────────────────────────

export const DashboardModule = ({ currentContract }: { currentContract: Contract }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [progressFilter, setProgressFilter] = useState<number | "all">("all");
  const [surveyFilter, setSurveyFilter] = useState<number | "all">("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?contrato=${currentContract}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [currentContract]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-wfs-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Erro ao carregar dados do dashboard.</p>
        <button onClick={load} className="mt-3 text-xs text-wfs-accent hover:underline">Tentar novamente</button>
      </div>
    );
  }

  // ── Cálculos ─────────────────────────────────────────────────────────────────

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isActive = (c: CourseProgress) => {
    const start = c.data_inicio ? new Date(c.data_inicio + "T00:00:00") : null;
    const end = c.data_fim ? new Date(c.data_fim + "T23:59:59") : null;
    return (!start || today >= start) && (!end || today <= end);
  };

  const activeCourses = data.courseProgress.filter(isActive);
  const totalEmp = data.empCounts.auxiliar + data.empCounts.ope + data.empCounts.analista + data.empCounts.tst + data.empCounts.lider;

  const filteredProgress = progressFilter === "all"
    ? data.courseProgress
    : data.courseProgress.filter(c => c.id === progressFilter);

  const totalCompleted = filteredProgress.reduce((s, c) => s + c.completed, 0);
  const totalTarget = filteredProgress.reduce((s, c) => s + c.totalEmployees, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

  const filteredSurveys = surveyFilter === "all"
    ? data.surveys
    : data.surveys.filter(s => s.curso_id === surveyFilter);

  const surveyCount = filteredSurveys.length;

  const questionAvgs = SURVEY_QUESTIONS.map((_, i) => {
    const key = `q${i + 1}`;
    const vals = filteredSurveys
      .map(s => s.respostas?.[key])
      .filter((v): v is number => typeof v === "number");
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  const validAvgs = questionAvgs.filter((v): v is number => v !== null);
  const overallSurveyAvg = validAvgs.length > 0
    ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length
    : null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-medium text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-wfs-accent" /> Dashboard de Treinamentos
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {lastUpdate
              ? `Atualizado às ${lastUpdate.toLocaleTimeString("pt-BR")} · atualiza automaticamente a cada 30s`
              : "Carregando..."}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-xs font-medium bg-white border border-slate-200 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Colaboradores"
          value={String(totalEmp)}
          sub={`${data.empCounts.auxiliar} Aux · ${data.empCounts.ope} OPE · ${data.empCounts.analista} Analista · ${data.empCounts.tst} TST · ${data.empCounts.lider} Líder`}
          color="blue"
        />
        <KpiCard
          icon={<BookOpen className="w-5 h-5" />}
          label="Cursos Ativos"
          value={String(activeCourses.length)}
          sub={`de ${data.courseProgress.length} cadastrados`}
          color="green"
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Conclusão Geral"
          value={`${overallPct}%`}
          sub={`${totalCompleted} de ${totalTarget} realizações`}
          color="accent"
        />
        <KpiCard
          icon={<Star className="w-5 h-5" />}
          label="Nota de Reação"
          value={overallSurveyAvg !== null ? overallSurveyAvg.toFixed(1) : "–"}
          sub={surveyCount > 0 ? `${surveyCount} avaliação${surveyCount !== 1 ? "ões" : ""}` : "Sem respostas ainda"}
          color="yellow"
        />
      </div>

      {/* Progresso por Treinamento */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Progresso por Treinamento
          </h3>
          <select
            value={progressFilter === "all" ? "all" : String(progressFilter)}
            onChange={e => setProgressFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600 outline-none cursor-pointer focus:ring-2 focus:ring-wfs-accent/20 focus:border-wfs-accent"
          >
            <option value="all">Todos os Treinamentos</option>
            {data.courseProgress.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {filteredProgress.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Nenhum treinamento encontrado.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProgress.map(c => {
              const active = isActive(c);
              const pa = c.publico_alvo?.length === 0 ? "Todos" : (c.publico_alvo?.join(" + ") || "Todos");
              const barColor = c.pct >= 80 ? "bg-green-500" : c.pct >= 50 ? "bg-yellow-500" : "bg-wfs-accent";

              return (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className="text-sm font-medium text-slate-800">{c.nome}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {active ? "● ATIVO" : "ENCERRADO"}
                        </span>
                        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {pa}
                        </span>
                        {c.tipo_conteudo && (
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {c.tipo_conteudo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${c.pct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full rounded-full ${barColor}`}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-700 w-9 text-right shrink-0">
                          {c.pct}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right sm:ml-4 shrink-0">
                      <p className="text-2xl font-mono font-bold text-slate-900 leading-none">
                        {c.completed}
                        <span className="text-base text-slate-300 font-light">/{c.totalEmployees}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">concluíram</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumo rodapé */}
        {filteredProgress.length > 1 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-medium">
              Total: {filteredProgress.length} treinamento{filteredProgress.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {totalCompleted}/{totalTarget} concluídos · {overallPct}%
            </span>
          </div>
        )}
      </div>

      {/* Avaliação de Reação */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            Avaliação de Reação
            {surveyCount > 0 && (
              <span className="text-[10px] font-normal text-slate-400">
                · {surveyCount} resposta{surveyCount !== 1 ? "s" : ""}
              </span>
            )}
          </h3>
          <select
            value={surveyFilter === "all" ? "all" : String(surveyFilter)}
            onChange={e => setSurveyFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600 outline-none cursor-pointer focus:ring-2 focus:ring-wfs-accent/20 focus:border-wfs-accent"
          >
            <option value="all">Todos os Treinamentos</option>
            {data.courseProgress.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {surveyCount === 0 ? (
          <div className="text-center py-12">
            <Star className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Nenhuma avaliação recebida ainda.</p>
          </div>
        ) : (
          <div className="p-5 space-y-6">

            {/* Nota geral */}
            {overallSurveyAvg !== null && (
              <div className="flex items-center gap-5 bg-slate-50 rounded-xl p-5">
                <div className="text-center shrink-0">
                  <p className={`text-5xl font-mono font-bold leading-none
                    ${overallSurveyAvg >= 4 ? "text-green-600" : overallSurveyAvg >= 3 ? "text-yellow-600" : "text-red-600"}`}>
                    {overallSurveyAvg.toFixed(1)}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-widest mt-1">NOTA GERAL</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-end gap-1 h-8 mb-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <div
                        key={n}
                        className={`flex-1 rounded-sm transition-all
                          ${n <= Math.round(overallSurveyAvg)
                            ? (overallSurveyAvg >= 4 ? "bg-green-400" : overallSurveyAvg >= 3 ? "bg-yellow-400" : "bg-red-400")
                            : "bg-slate-200"}`}
                        style={{ height: `${(n / 5) * 100}%` }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">Média geral · escala de 1 a 5</p>
                  <p className="text-[10px] text-slate-400">{surveyCount} avaliação{surveyCount !== 1 ? "ões" : ""} recebida{surveyCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
            )}

            {/* Por questão */}
            <div className="space-y-3">
              {SURVEY_QUESTIONS.map((q, i) => {
                const avg = questionAvgs[i];
                if (avg === null) return null;
                const pct = (avg / 5) * 100;
                const barColor = avg >= 4 ? "bg-green-500" : avg >= 3 ? "bg-yellow-500" : "bg-red-500";
                const textColor = avg >= 4 ? "text-green-700" : avg >= 3 ? "text-yellow-700" : "text-red-700";

                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-wfs-accent w-5 shrink-0 text-right">{i + 1}.</span>
                    <span className="text-xs text-slate-600 w-48 shrink-0 truncate hidden sm:block" title={q}>{q}</span>
                    <span className="text-xs text-slate-600 flex-1 min-w-0 truncate sm:hidden" title={q}>{q}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden min-w-0 hidden sm:block">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
                        className={`h-full rounded-full ${barColor}`}
                      />
                    </div>
                    <span className={`text-xs font-mono font-bold w-8 text-right shrink-0 ${textColor}`}>
                      {avg.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: "blue" | "green" | "accent" | "yellow";
}) => {
  const iconCls: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    accent: "bg-red-50 text-wfs-accent",
    yellow: "bg-yellow-50 text-yellow-600",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconCls[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-mono font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase mt-0.5">{label}</p>
        <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
      </div>
    </div>
  );
};
