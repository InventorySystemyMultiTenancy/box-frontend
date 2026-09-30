"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  STATUS_LABELS,
  ServiceOrder,
  Estimate,
  ESTIMATE_STATUS_LABELS,
  User,
  Vehicle,
  Supplier,
  InventoryPart,
  Truck,
  InsuranceCompany,
} from "@/lib/types";

const ROLE_LABELS: Record<string, string> = { CUSTOMER: "Cliente", MECHANIC: "Mecânico", ADMIN: "Admin" };

interface AssistAction {
  path: string;
  label: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  steps?: string[] | null;
  actions?: AssistAction[];
  suggestedQuery?: string | null;
  failed?: boolean;
}

function AssistBubble({ msg, onSuggestedQuery }: { msg: ChatMessage; onSuggestedQuery: (q: string) => void }) {
  if (msg.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
        {msg.text}
      </div>
    );
  }

  if (msg.failed) {
    return <p className="text-sm text-destructive">{msg.text}</p>;
  }

  return (
    <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-primary/30 bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Sparkles className="size-3.5" /> {msg.steps ? "Tutorial da IA" : "Resposta da IA"}
      </div>
      <p className="mb-3 text-sm text-foreground">{msg.text}</p>
      {msg.steps && (
        <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-foreground">
          {msg.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        {msg.suggestedQuery && (
          <button
            type="button"
            onClick={() => onSuggestedQuery(msg.suggestedQuery!)}
            className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Buscar por &quot;{msg.suggestedQuery}&quot;
          </button>
        )}
        {msg.actions?.map((action) => (
          <Link
            key={action.path}
            href={action.path}
            className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Ir para {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function BuscaGlobalPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  // Preenche com o termo vindo da busca do header (?q=...), se houver.
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  // Aba em que a pessoa estava ao buscar (?from=) — dá contexto pra IA responder
  // "o que é essa aba?" sem precisar que ela cole a URL manualmente.
  const fromPath = searchParams.get("from");

  const { data, isFetching, isError } = useQuery({
    queryKey: ["global-search", q],
    queryFn: async () => {
      const res = await api.globalSearch(q, token!);
      return {
        orders: (res.orders ?? []) as ServiceOrder[],
        estimates: (res.estimates ?? []) as Estimate[],
        users: (res.users ?? []) as User[],
        vehicles: (res.vehicles ?? []) as Vehicle[],
        suppliers: (res.suppliers ?? []) as Supplier[],
        parts: (res.parts ?? []) as InventoryPart[],
        trucks: (res.trucks ?? []) as Truck[],
        insuranceCompanies: (res.insuranceCompanies ?? []) as InsuranceCompany[],
      };
    },
    enabled: !!token && q.trim().length >= 2,
  });

  const totalResults = data
    ? data.orders.length +
      data.estimates.length +
      data.users.length +
      data.vehicles.length +
      data.suppliers.length +
      data.parts.length +
      data.trucks.length +
      data.insuranceCompanies.length
    : 0;

  // "Como cadastrar cliente?", "como avançar etapa" etc. são perguntas de uso, não
  // busca de registro — nesse caso vale perguntar à IA mesmo se a busca por texto
  // (coincidência) tiver achado algo, já que a pessoa não está procurando um registro.
  const isHowToQuestion = /^(como|onde|qual|quais|quando|quem|o que|pra que|para que|por que|porque)\b/i.test(q.trim()) || q.trim().endsWith("?");

  // Primeiro turno: mesmo mecanismo de antes (debounce + useQuery), só disparado
  // enquanto a conversa ainda não começou — depois disso quem conduz é o chat abaixo.
  const [assistQuery, setAssistQuery] = useState<string | null>(null);

  const {
    data: firstAssist,
    isFetching: firstAssistLoading,
    isError: firstAssistFailed,
  } = useQuery({
    queryKey: ["search-assist", assistQuery, fromPath],
    queryFn: () => api.searchAssist(assistQuery!, token!, fromPath ?? undefined),
    enabled: !!token && !!assistQuery,
    retry: false,
  });

  // Derivado (não guardado em state): true assim que a 1ª resposta da IA chega pra essa
  // mesma pergunta — a partir daí o efeito abaixo para de repetir sozinho e quem passa a
  // conduzir é o chat (envio manual pelo formulário de resposta).
  const chatStarted = !!firstAssist && assistQuery === q.trim();

  useEffect(() => {
    if (chatStarted || isFetching || q.trim().length < 2 || (totalResults > 0 && !isHowToQuestion)) return;
    const timer = setTimeout(() => setAssistQuery(q.trim()), 700);
    return () => clearTimeout(timer);
  }, [q, isFetching, totalResults, isHowToQuestion, chatStarted]);

  // Chat continua a partir do 2º turno — mensagens trocadas depois da 1ª resposta da IA.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  async function sendReply(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !token || sendingReply || !assistQuery || !firstAssist) return;
    setReplyText("");
    setChatMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setSendingReply(true);
    try {
      const history = [
        { role: "user" as const, content: assistQuery },
        { role: "assistant" as const, content: firstAssist.message },
        // Não repassa mensagens de erro genéricas como se a IA tivesse dito aquilo —
        // confundiria os próximos turnos.
        ...chatMessages.filter((m) => !m.failed).map((m) => ({ role: m.role, content: m.text })),
      ];
      const result = await api.searchAssist(trimmed, token, fromPath ?? undefined, history);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: result.message, steps: result.steps, actions: result.actions, suggestedQuery: result.suggestedQuery },
      ]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Não consegui responder agora. Tente de novo em instantes.", failed: true }]);
    } finally {
      setSendingReply(false);
    }
  }

  function handleSuggestedQuery(suggested: string) {
    setChatMessages([]);
    setAssistQuery(null);
    setQ(suggested);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Busca global</h1>
        <p className="text-sm text-muted-foreground">
          Busca em tudo: OS, orçamento, clientes, usuários, veículos, peças, fornecedores, caminhões e seguradoras.
          Ou pergunte como fazer algo, ex.: &quot;como cadastrar cliente&quot;, &quot;como avançar etapa&quot;.
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder='Buscar ou perguntar "como fazer..."'
          className="pr-9 pl-8"
          value={q}
          onChange={(e) => {
            setChatMessages([]);
            setQ(e.target.value);
          }}
          autoFocus
        />
        <VoiceInputButton
          onTranscribed={(text) => {
            setChatMessages([]);
            setQ(text);
          }}
          title="Perguntar por voz"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        />
      </form>

      {q.trim().length < 2 && <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres.</p>}
      {isFetching && <p className="text-sm text-muted-foreground">Buscando...</p>}
      {isError && <p className="text-sm text-destructive">Não foi possível buscar agora. Tente de novo.</p>}

      {data && (
        <div className="grid gap-6">
          {data.orders.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ordens de serviço</h2>
              <div className="grid gap-2">
                {data.orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard?order=${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{order.vehicle.brand} {order.vehicle.model}</strong>{" "}
                      <span className="font-mono text-xs text-muted-foreground">{order.code}</span>
                      {order.vehicle.plate && <span className="text-muted-foreground"> · {order.vehicle.plate}</span>}
                    </span>
                    <Badge variant="outline">{STATUS_LABELS[order.status]}</Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.estimates.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orçamentos</h2>
              <div className="grid gap-2">
                {data.estimates.map((estimate) => (
                  <Link
                    key={estimate.id}
                    href={`/dashboard?order=${estimate.serviceOrderId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span className="font-mono text-xs">{estimate.code}</span>
                    <Badge variant="outline">{ESTIMATE_STATUS_LABELS[estimate.status]}</Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.users.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usuários e clientes</h2>
              <div className="grid gap-2">
                {data.users.map((u) => (
                  <Link
                    key={u.id}
                    href={u.role === "CUSTOMER" ? "/dashboard/clientes" : "/dashboard/usuarios"}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{u.name}</strong>{" "}
                      <span className="text-muted-foreground">{u.email}</span>
                      {u.phone && <span className="text-muted-foreground"> · {u.phone}</span>}
                    </span>
                    <Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.vehicles.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Veículos</h2>
              <div className="grid gap-2">
                {data.vehicles.map((v) => (
                  <Link
                    key={v.id}
                    href={v.owner ? `/dashboard/clientes/${v.owner.id}` : "/dashboard/clientes"}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{v.brand} {v.model}</strong>
                      {v.plate && <span className="font-mono text-xs text-muted-foreground"> · {v.plate}</span>}
                      {v.owner && <span className="text-muted-foreground"> · {v.owner.name}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.suppliers.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fornecedores</h2>
              <div className="grid gap-2">
                {data.suppliers.map((s) => (
                  <Link
                    key={s.id}
                    href="/dashboard/fornecedores"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{s.name}</strong>
                      {s.phone && <span className="text-muted-foreground"> · {s.phone}</span>}
                      {s.email && <span className="text-muted-foreground"> · {s.email}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.parts.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Peças e materiais</h2>
              <div className="grid gap-2">
                {data.parts.map((p) => (
                  <Link
                    key={p.id}
                    href="/dashboard/pecas"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{p.name}</strong>
                      {p.sku && <span className="font-mono text-xs text-muted-foreground"> · {p.sku}</span>}
                    </span>
                    <Badge variant="outline">{p.stockQty} em estoque</Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.trucks.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caminhões</h2>
              <div className="grid gap-2">
                {data.trucks.map((t) => (
                  <Link
                    key={t.id}
                    href="/dashboard/caminhoes"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{t.plate}</strong>
                      {(t.brand || t.model) && <span className="text-muted-foreground"> · {t.brand} {t.model}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.insuranceCompanies.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seguradoras</h2>
              <div className="grid gap-2">
                {data.insuranceCompanies.map((i) => (
                  <Link
                    key={i.id}
                    href="/dashboard/seguradoras"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{i.legalName}</strong>
                      {i.tradeName && <span className="text-muted-foreground"> · {i.tradeName}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {q.trim().length >= 2 && !isFetching && (totalResults === 0 || isHowToQuestion) && (
            <div className="grid gap-3">
              {totalResults === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum resultado encontrado para &quot;{q.trim()}&quot;.</p>
              )}

              {firstAssistLoading && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4 shadow-sm">
                  <span className="relative flex size-10 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" />
                    <span className="relative flex size-9 items-center justify-center rounded-full bg-primary">
                      <Sparkles className="size-5 text-primary-foreground" />
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-bold text-primary">Analisando com IA...</p>
                    <p className="text-xs text-muted-foreground">Só um instante, buscando uma sugestão pra você.</p>
                  </div>
                </div>
              )}

              {firstAssist && assistQuery === q.trim() && (
                <>
                  <AssistBubble
                    msg={{
                      role: "assistant",
                      text: firstAssist.message,
                      steps: firstAssist.steps,
                      actions: firstAssist.actions,
                      suggestedQuery: firstAssist.suggestedQuery,
                    }}
                    onSuggestedQuery={handleSuggestedQuery}
                  />

                  {chatMessages.map((msg, i) => (
                    <AssistBubble key={i} msg={msg} onSuggestedQuery={handleSuggestedQuery} />
                  ))}

                  {sendingReply && <p className="text-xs text-muted-foreground">A IA está respondendo...</p>}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendReply(replyText);
                    }}
                    className="relative mt-1"
                  >
                    <Input
                      placeholder='Não era isso? Reformule ou responda, ex.: "me ajude com nota fiscal"'
                      className="pr-16"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      disabled={sendingReply}
                    />
                    <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                      <VoiceInputButton
                        onTranscribed={(text) => sendReply(text)}
                        disabled={sendingReply}
                        title="Responder por voz"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || !replyText.trim()}
                        aria-label="Enviar"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Send className="size-4" />
                      </button>
                    </div>
                  </form>
                </>
              )}

              {firstAssistFailed && assistQuery === q.trim() && (
                <p className="text-sm text-destructive">
                  Não consegui gerar uma sugestão agora. Tente de novo em instantes.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
