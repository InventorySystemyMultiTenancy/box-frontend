import Image from "next/image";
import Reveal from "./Reveal";
import styles from "./landing.module.css";

export function Presentation() {
  return (
    <section className={styles.section}>
      <Reveal>
        <div className={styles.sectionHead}>
          <span className="eyebrow">A oficina</span>
          <h2>Uma equipe técnica que documenta cada passo.</h2>
          <p>
            Somos uma oficina multimarcas que trata cada ordem de serviço como um relatório de
            engenharia: tudo o que é encontrado, trocado ou testado fica registrado e visível para
            você, no momento em que acontece.
          </p>
        </div>
      </Reveal>
      <Reveal delay={80}>
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={`mono ${styles.v}`}>11</div>
            <div className={styles.l}>anos de operação</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.v}`}>6.400+</div>
            <div className={styles.l}>veículos atendidos</div>
          </div>
          <div className={styles.stat}>
            <div className={`mono ${styles.v}`}>4.9/5</div>
            <div className={styles.l}>nota média dos clientes</div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const DIFFERENTIALS = [
  { title: "Você aprova pelo celular", text: "Todo problema novo encontrado vira uma notificação com fotos e valor — aprovar ou recusar é um toque." },
  { title: "Timeline ao vivo", text: "Cada evento da manutenção aparece no seu painel no instante em que o mecânico registra." },
  { title: "Peça por peça", text: "Motor, freios, suspensão e mais 10 sistemas com histórico individual, não um status genérico." },
  { title: "Garantia rastreável", text: "Toda peça trocada tem prazo de garantia salvo na sua conta, não em um papel que se perde." },
];

export function Differentiators() {
  return (
    <section className={styles.section} id="diferenciais">
      <Reveal>
        <div className={styles.sectionHead}>
          <span className="eyebrow">Diferenciais</span>
          <h2>O que muda quando o carro entra aqui.</h2>
        </div>
      </Reveal>
      <div className={styles.grid}>
        {DIFFERENTIALS.map((d, i) => (
          <Reveal key={d.title} delay={i * 60}>
            <div className={styles.card}>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const SERVICES = [
  "Motor", "Freios", "Suspensão", "Transmissão", "Embreagem", "Escapamento",
  "Direção", "Elétrica", "Ar-condicionado", "Pneus e alinhamento", "Bateria", "Arrefecimento",
];

export function Services() {
  return (
    <section className={styles.section} id="servicos">
      <Reveal>
        <div className={styles.sectionHead}>
          <span className="eyebrow">Serviços</span>
          <h2>Cobertura completa, um vocabulário só.</h2>
          <p>A mesma categoria que você escolhe aqui é a que aparece depois no seu painel de acompanhamento.</p>
        </div>
      </Reveal>
      <div className={styles.grid}>
        {SERVICES.map((s, i) => (
          <Reveal key={s} delay={i * 40}>
            <div className={styles.card}>
              <h3>{s}</h3>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const PROCESS = [
  { n: "01", title: "Chegada", text: "Check-in fotográfico de 360° na entrada do veículo." },
  { n: "02", title: "Diagnóstico", text: "Inspeção técnica com laudo, fotos e vídeos anexados." },
  { n: "03", title: "Aprovação", text: "Você decide o que é feito, com valor e evidência antes de qualquer troca." },
  { n: "04", title: "Entrega", text: "Checklist de saída assinado digitalmente por você e pelo mecânico responsável." },
];

export function ProcessSteps() {
  return (
    <section className={styles.section}>
      <Reveal>
        <div className={styles.sectionHead}>
          <span className="eyebrow">Como funciona</span>
          <h2>Quatro etapas, sem telefonema no meio.</h2>
        </div>
      </Reveal>
      <Reveal delay={60}>
        <div className={styles.processFlow}>
          {PROCESS.map((p) => (
            <div key={p.n} className={styles.processStep}>
              <div className={`mono ${styles.n}`}>{p.n}</div>
              <h4>{p.title}</h4>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const TESTIMONIALS = [
  { quote: "Vi a foto da peça que trocaram antes mesmo de irem me ligar. Nunca tive isso em oficina nenhuma.", name: "Fernanda R.", car: "Jeep Compass 2022 · Troca de embreagem" },
  { quote: "Aprovei o orçamento extra pelo celular, no meio de uma reunião, sem precisar sair para atender ligação.", name: "Carlos E.", car: "HB20 2019 · Suspensão" },
];

export function Testimonials() {
  return (
    <section className={styles.section}>
      <Reveal>
        <div className={styles.sectionHead}>
          <span className="eyebrow">Depoimentos</span>
          <h2>Quem já acompanhou o próprio carro.</h2>
        </div>
      </Reveal>
      <div className={styles.grid}>
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 80}>
            <div className={styles.testimonial}>
              <p>&ldquo;{t.quote}&rdquo;</p>
              <footer>{t.name} · {t.car}</footer>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const TEAM = [
  { initials: "DM", name: "Diego M.", role: "Mecânico-chefe · motor e transmissão" },
  { initials: "AP", name: "Ana P.", role: "Elétrica e diagnóstico automotivo" },
  { initials: "RS", name: "Rafael S.", role: "Suspensão e freios" },
];

export function Team() {
  return (
    <section className={styles.section} id="equipe">
      <Reveal>
        <div className={styles.sectionHead}>
          <span className="eyebrow">Equipe</span>
          <h2>Quem assina cada serviço.</h2>
          <p>O mesmo nome que aparece aqui é o &ldquo;responsável pelo serviço&rdquo; na sua timeline.</p>
        </div>
      </Reveal>
      <div className={styles.teamGrid}>
        {TEAM.map((m, i) => (
          <Reveal key={m.name} delay={i * 60}>
            <div className={styles.teamCard}>
              <div className={styles.avatar}>{m.initials}</div>
              <h4>{m.name}</h4>
              <p>{m.role}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Partners() {
  return (
    <section className={styles.section}>
      <Reveal>
        <div className={styles.partnersRow}>
          <span>Bosch</span>
          <span>NGK</span>
          <span>Porto Seguro</span>
          <span>Mapfre</span>
          <span>Cofap</span>
        </div>
      </Reveal>
    </section>
  );
}

export function SchedulingCta() {
  return (
    <section className={styles.section} id="agendamento">
      <Reveal>
        <div className={styles.ctaBand}>
          <div>
            <span className="eyebrow">Agendamento</span>
            <h2>Escolha um horário real na oficina.</h2>
          </div>
          <a href="#orcamento" className={`${styles.btn} ${styles.btnPrimary}`}>
            Ver horários disponíveis
          </a>
        </div>
      </Reveal>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={styles.section} id="orcamento">
      <Reveal>
        <div className={styles.ctaBand}>
          <div>
            <span className="eyebrow">Orçamento</span>
            <h2>Monte seu orçamento antes de falar com alguém.</h2>
          </div>
          <a href="/login" className={`${styles.btn} ${styles.btnPrimary}`}>
            Iniciar orçamento
          </a>
        </div>
      </Reveal>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerBrand}>
        <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className={styles.brandLogo} />
      </div>
      Reblind — acompanhamento de manutenção em tempo real.
    </footer>
  );
}
