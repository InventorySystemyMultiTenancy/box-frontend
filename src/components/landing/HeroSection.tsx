"use client";

import Link from "next/link";
import { ReactNode } from "react";
import HeroScrollVideo from "./HeroScrollVideo";
import styles from "./landing.module.css";

export default function HeroSection({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.heroWrap}>
      <nav className={styles.nav}>
        <span className={styles.navBrand}>BOX.</span>
        <div className={styles.navLinks}>
          <a href="#diferenciais">Diferenciais</a>
          <a href="#servicos">Serviços</a>
          <a href="#equipe">Equipe</a>
          <a href="#agendamento">Agendamento</a>
          <Link href="/login" className={styles.navCta}>
            Área do cliente
          </Link>
        </div>
      </nav>
      <HeroScrollVideo>
        <section className={styles.heroOverlay}>
          <span className={styles.heroLive}>
            <i /> 3 VEÍCULOS EM MANUTENÇÃO AGORA
          </span>
          <h1 className={styles.heroTitle}>Seu carro, acompanhado em tempo real.</h1>
          <p className={styles.heroLede}>
            Da chegada à retirada, cada etapa da manutenção vira um evento que você vê acontecer —
            fotos, laudos e aprovação, sem precisar perguntar o que está sendo feito.
          </p>
          <div className={styles.heroActions}>
            <a href="#orcamento" className={`${styles.btn} ${styles.btnPrimary}`}>
              Montar orçamento
            </a>
            <a href="#agendamento" className={`${styles.btn} ${styles.btnGhost}`}>
              Agendar visita
            </a>
          </div>
        </section>
        <div className={styles.heroContent}>{children}</div>
      </HeroScrollVideo>
    </div>
  );
}
