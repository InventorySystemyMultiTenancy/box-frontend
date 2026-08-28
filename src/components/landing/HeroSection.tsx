"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import dynamic from "next/dynamic";
import styles from "./landing.module.css";

// Componente decorativo e dependente do viewport real (mobile vs. desktop) — nunca
// precisa ser renderizado no servidor, e evita qualquer divergência de hidratação.
const HeroScrollVideo = dynamic(() => import("./HeroScrollVideo"), { ssr: false });

const NAV_LINKS = [
  { href: "#diferenciais", label: "Diferenciais" },
  { href: "#servicos", label: "Serviços" },
  { href: "#equipe", label: "Equipe" },
  { href: "#agendamento", label: "Agendamento" },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function HeroSection({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.heroWrap}>
      <nav className={styles.nav}>
        <button
          type="button"
          className={styles.navBrand}
          aria-label="Voltar ao topo"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className={styles.brandLogo} priority />
        </button>
        <div className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(link.href.slice(1));
              }}
            >
              {link.label}
            </a>
          ))}
          <Link href="/login" className={styles.navCta}>
            Área do cliente
          </Link>
        </div>
        <button
          type="button"
          className={styles.navToggle}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={menuOpen ? styles.navToggleOpen : ""} />
          <span className={menuOpen ? styles.navToggleOpen : ""} />
          <span className={menuOpen ? styles.navToggleOpen : ""} />
        </button>
      </nav>

      {menuOpen && (
        <div className={styles.navMobileMenu}>
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => {
                setMenuOpen(false);
                scrollToId(link.href.slice(1));
              }}
            >
              {link.label}
            </button>
          ))}
          <Link href="/login" className={styles.navCta} onClick={() => setMenuOpen(false)}>
            Área do cliente
          </Link>
        </div>
      )}

      <HeroScrollVideo
        overlay={
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
              <a
                href="#orcamento"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToId("orcamento");
                }}
              >
                Montar orçamento
              </a>
            </div>
          </section>
        }
      >
        <div className={styles.heroContent}>{children}</div>
      </HeroScrollVideo>
    </div>
  );
}
