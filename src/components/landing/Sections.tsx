import Image from "next/image";
import {
  Activity,
  ArrowRight,
  Battery,
  CircleDot,
  Cog,
  Disc,
  Disc3,
  Hammer,
  Layers,
  MapPin,
  Paintbrush,
  Phone,
  Quote,
  Route,
  Settings2,
  Shield,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Thermometer,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { api, API_URL } from "@/lib/api";
import EngineeringSceneLoader from "./premium/EngineeringSceneLoader";
import ProcessVideoScene from "./premium/ProcessVideoScene";
import { Appear, Counter, LiveTimelineDemo, TiltCard } from "./premium/Interactive";
import styles from "./premium/premium.module.css";

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function SectionHead({ eyebrow, title, text, center = false }: { eyebrow: string; title: string; text?: string; center?: boolean }) {
  return (
    <Appear className={`${styles.sectionHead} ${center ? styles.sectionHeadCenter : ""}`}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </Appear>
  );
}

const STATS = [
  { value: "17", label: "anos de operação" },
  { value: "6.400+", label: "veículos atendidos" },
  { value: "4.9/5", label: "nota média dos clientes" },
];

export function Presentation() {
  return (
    <section className={`${styles.section} ${styles.presentation}`}>
      <div className={styles.presentationGrid}>
        <SectionHead
          eyebrow="A oficina"
          title="Uma equipe técnica que documenta cada passo."
          text="Somos a Reblind, especializada em blindagem — reparo, recuperação e documentação —, funilaria, pintura e mecânica, homologada pelo Ministério da Defesa (Exército Brasileiro) e associada à ABRABLIN. Tratamos cada ordem de serviço como um relatório de engenharia: tudo o que é encontrado, trocado ou testado fica registrado e visível para você, no momento em que acontece."
        />
        <div className={styles.statsCol}>
          {STATS.map((s, i) => (
            <Appear key={s.label} delay={i * 110}>
              <div className={styles.stat}>
                <div className={styles.statValue}>
                  <Counter value={s.value} />
                </div>
                <div className={styles.statLabel}>{s.label}</div>
                <span className={styles.statLine} aria-hidden />
              </div>
            </Appear>
          ))}
        </div>
      </div>
    </section>
  );
}

const DIFFERENTIALS: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Você aprova pelo celular", text: "Todo problema novo encontrado vira uma notificação com fotos e valor — aprovar ou recusar é um toque.", icon: Smartphone },
  { title: "Timeline ao vivo", text: "Cada evento da manutenção aparece no seu painel no instante em que o mecânico registra.", icon: Activity },
  { title: "Peça por peça", text: "Motor, freios, suspensão e mais 10 sistemas com histórico individual, não um status genérico.", icon: Layers },
  { title: "Garantia rastreável", text: "Toda peça trocada tem prazo de garantia salvo na sua conta, não em um papel que se perde.", icon: ShieldCheck },
];

export function Differentiators() {
  return (
    <section className={`${styles.section} ${styles.tech}`} id="diferenciais">
      <SectionHead eyebrow="Diferenciais" title="O que muda quando o carro entra aqui." />
      <div className={styles.techGrid}>
        <Appear className={styles.techVisual}>
          <div className={styles.techImage}>
            <Image src="/landing/holo-cockpit.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 50vw" className={styles.cover} />
            <span className={styles.scanline} aria-hidden />
          </div>
          <div className={styles.techFloat}>
            <LiveTimelineDemo />
          </div>
        </Appear>
        <div className={styles.techList}>
          {DIFFERENTIALS.map((d, i) => (
            <Appear key={d.title} delay={i * 90}>
              <TiltCard className={styles.diffCard} max={5}>
                <span className={styles.iconBox}>
                  <d.icon aria-hidden />
                </span>
                <div>
                  <h3>{d.title}</h3>
                  <p>{d.text}</p>
                </div>
              </TiltCard>
            </Appear>
          ))}
        </div>
      </div>
    </section>
  );
}

const SPECIALTIES: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Blindagem", text: "Reparo, recuperação e documentação de veículos blindados.", icon: Shield },
  { title: "Funilaria", text: "Recuperação estrutural e de carroceria.", icon: Hammer },
  { title: "Pintura", text: "Acabamento e pintura automotiva.", icon: Paintbrush },
];

const SERVICES: { name: string; text: string; icon: LucideIcon }[] = [
  { name: "Motor", text: "Diagnóstico, reparo e manutenção do conjunto do motor.", icon: Cog },
  { name: "Freios", text: "Discos, pastilhas, pinças e fluido, com evidência antes da troca.", icon: Disc3 },
  { name: "Suspensão", text: "Amortecedores, molas, bandejas e buchas.", icon: Waves },
  { name: "Transmissão", text: "Câmbio e componentes de transmissão.", icon: Settings2 },
  { name: "Embreagem", text: "Kit de embreagem, acionamento e regulagem.", icon: CircleDot },
  { name: "Escapamento", text: "Tubulação, silenciosos e fixações.", icon: Wind },
  { name: "Direção", text: "Caixa de direção, terminais e folgas.", icon: Route },
  { name: "Elétrica", text: "Faróis, módulos, chicotes e diagnóstico elétrico.", icon: Zap },
  { name: "Ar-condicionado", text: "Carga de gás, filtros e componentes do sistema.", icon: Snowflake },
  { name: "Pneus e alinhamento", text: "Pneus, alinhamento e balanceamento.", icon: Disc },
  { name: "Bateria", text: "Teste, carga e substituição.", icon: Battery },
  { name: "Arrefecimento", text: "Radiador, bomba d'água, mangueiras e fluido.", icon: Thermometer },
];

export function Services() {
  return (
    <>
      <EngineeringSceneLoader />
      <section className={styles.section} id="servicos">
        <SectionHead
          eyebrow="Serviços"
          title="Cobertura completa, um vocabulário só."
          text="A mesma categoria que você escolhe aqui é a que aparece depois no seu painel de acompanhamento."
        />
        <div className={styles.specialties}>
          {SPECIALTIES.map((s, i) => (
            <Appear key={s.title} delay={i * 100}>
              <TiltCard className={styles.specialtyCard}>
                <span className={styles.specialtyGlow} aria-hidden />
                <s.icon className={styles.specialtyIcon} aria-hidden />
                <span className={styles.specialtyTag}>Especialidade</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </TiltCard>
            </Appear>
          ))}
          <Appear delay={300} className={styles.specialtyImageWrap}>
            <div className={styles.specialtyImage}>
              <Image src="/landing/suspension.jpg" alt="Conjunto de suspensão e freio em vista explodida" fill sizes="(max-width: 900px) 100vw, 33vw" className={styles.cover} />
              <span className={styles.imageLabel}>
                <span className="mono">SUSPENSÃO · FREIOS</span>
                Vista explodida
              </span>
            </div>
          </Appear>
        </div>
        <div className={styles.serviceGrid}>
          {SERVICES.map((s, i) => (
            <Appear key={s.name} delay={(i % 4) * 70}>
              <TiltCard className={styles.serviceCard}>
                <span className={styles.serviceIcon}>
                  <s.icon aria-hidden />
                </span>
                <span className={`mono ${styles.serviceIndex}`}>{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.name}</h3>
                <p>{s.text}</p>
                <span className={styles.serviceRule} aria-hidden />
              </TiltCard>
            </Appear>
          ))}
        </div>
      </section>
    </>
  );
}

const PROCESS = [
  { n: "01", title: "Chegada", text: "Check-in fotográfico de 360° na entrada do veículo." },
  { n: "02", title: "Diagnóstico", text: "Inspeção técnica com laudo, fotos e vídeos anexados." },
  { n: "03", title: "Aprovação", text: "Você decide o que é feito, com valor e evidência antes de qualquer troca." },
  { n: "04", title: "Entrega", text: "Checklist de saída assinado digitalmente por você e pelo mecânico responsável." },
];

export function ProcessSteps() {
  return <ProcessVideoScene steps={PROCESS} eyebrow="Como funciona" title="Quatro etapas, sem telefonema no meio." />;
}

const TESTIMONIALS = [
  { quote: "Vi a foto da peça que trocaram antes mesmo de irem me ligar. Nunca tive isso em oficina nenhuma.", name: "Fernanda R.", car: "Jeep Compass 2022 · Troca de embreagem" },
  { quote: "Aprovei o orçamento extra pelo celular, no meio de uma reunião, sem precisar sair para atender ligação.", name: "Carlos E.", car: "HB20 2019 · Suspensão" },
];

export function Testimonials() {
  return (
    <section className={styles.section}>
      <SectionHead eyebrow="Depoimentos" title="Quem já acompanhou o próprio carro." />
      <div className={styles.testimonialGrid}>
        {TESTIMONIALS.map((t, i) => (
          <Appear key={t.name} delay={i * 120}>
            <TiltCard className={styles.testimonial} max={4}>
              <Quote className={styles.quoteIcon} aria-hidden />
              <p>&ldquo;{t.quote}&rdquo;</p>
              <footer>
                <span className={styles.testimonialAvatar}>{initials(t.name)}</span>
                <span>
                  <strong>{t.name}</strong>
                  <small>{t.car}</small>
                </span>
              </footer>
            </TiltCard>
          </Appear>
        ))}
      </div>
    </section>
  );
}

// Usado só se a API não responder (ex.: cold start) — a lista real vem de /api/team,
// alimentada pela foto de perfil que cada mecânico/admin sobe em "Meu perfil".
const FALLBACK_TEAM = [
  { id: "fallback-1", name: "Diego M.", role: "Reparo e recuperação de blindagem", avatarUrl: null },
  { id: "fallback-2", name: "Ana P.", role: "Funilaria e pintura", avatarUrl: null },
  { id: "fallback-3", name: "Rafael S.", role: "Mecânica e gestão de frotas", avatarUrl: null },
];

async function getTeam() {
  try {
    const { team } = await api.team();
    return team.length > 0 ? team : FALLBACK_TEAM;
  } catch {
    return FALLBACK_TEAM;
  }
}

export async function Team() {
  const team = await getTeam();
  return (
    <section className={styles.section} id="equipe">
      <SectionHead
        eyebrow="Equipe"
        title="Quem assina cada serviço."
        text="O mesmo nome que aparece aqui é o “responsável pelo serviço” na sua timeline."
      />
      <div className={styles.teamGrid}>
        {team.map((m, i) => (
          <Appear key={m.id} delay={(i % 4) * 80}>
            <TiltCard className={styles.teamCard} max={6}>
              <span className={styles.avatarRing}>
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(m.avatarUrl)} alt="" className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatar}>{initials(m.name)}</span>
                )}
              </span>
              <h4>{m.name}</h4>
              <p>{m.role}</p>
            </TiltCard>
          </Appear>
        ))}
      </div>
    </section>
  );
}

const PARTNERS = ["Exército Brasileiro · homologada", "ABRABLIN", "Jaguar", "Land Rover"];

export function Partners() {
  return (
    <section className={styles.partners} aria-label="Parceiros e homologações">
      <div className={styles.marquee}>
        {[0, 1].map((copy) => (
          <div key={copy} className={styles.marqueeRow} aria-hidden={copy === 1}>
            {[...PARTNERS, ...PARTNERS].map((p, i) => (
              <span key={`${copy}-${i}`}>
                <ShieldCheck aria-hidden />
                {p}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={styles.section} id="orcamento">
      <Appear>
        <div className={styles.ctaBand}>
          <Image src="/landing/holo-car.jpg" alt="" fill sizes="100vw" className={`${styles.cover} ${styles.ctaImage}`} />
          <div className={styles.ctaShade} aria-hidden />
          <div className={styles.ctaBody}>
            <span className={styles.eyebrow}>Orçamento</span>
            <h2>Monte seu orçamento antes de falar com alguém.</h2>
            <a href="/login" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}>
              Iniciar orçamento
              <ArrowRight aria-hidden />
            </a>
            <div className={styles.ctaContact}>
              <span>
                <MapPin aria-hidden /> Rua Antônio das Chagas, 530 — Chácara Santo Antônio, São Paulo/SP
              </span>
              <a href="tel:+551123370101">
                <Phone aria-hidden /> (11) 2337-0101
              </a>
            </div>
          </div>
        </div>
      </Appear>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className={styles.footerLogo} />
          <p>Reblind — acompanhamento de manutenção em tempo real.</p>
        </div>
        <div className={styles.footerInfo}>
          <p>Rua Antônio das Chagas, 530 — Chácara Santo Antônio, São Paulo/SP · (11) 2337-0101</p>
          <a href="/login" className={styles.footerLink}>
            Fazer login <ArrowRight aria-hidden />
          </a>
        </div>
      </div>
    </footer>
  );
}
