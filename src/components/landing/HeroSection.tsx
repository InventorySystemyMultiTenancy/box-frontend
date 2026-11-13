"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, ShieldCheck } from "lucide-react";
import styles from "./premium/premium.module.css";

// Holograma 3D (WebGL) — só no navegador, carregado depois do restante da página.
const HeroHologram = dynamic(() => import("./premium/HeroHologram"), { ssr: false });

const NAV_LINKS = [
  { href: "#diferenciais", label: "Diferenciais" },
  { href: "#servicos", label: "Serviços" },
  { href: "#equipe", label: "Equipe" },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const TITLE = "Seu carro, acompanhado em tempo real.";

export default function HeroSection({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState<string | null>(null);

  // Cabeçalho ganha fundo de vidro depois de rolar um pouco.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Link do menu ativo conforme a seção visível.
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.slice(1));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveLink(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className={styles.root}>
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
        <button type="button" className={styles.navBrand} aria-label="Voltar ao topo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className={styles.brandLogo} priority />
        </button>
        <div className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={activeLink === link.href.slice(1) ? styles.navLinkActive : ""}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(link.href.slice(1));
              }}
            >
              {link.label}
            </a>
          ))}
          <Link href="/login" className={styles.navCta}>
            Fazer login
            <ArrowRight className={styles.navCtaIcon} aria-hidden />
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

      <div className={`${styles.navMobileMenu} ${menuOpen ? styles.navMobileMenuOpen : ""}`} aria-hidden={!menuOpen}>
        {NAV_LINKS.map((link, i) => (
          <button
            key={link.href}
            type="button"
            tabIndex={menuOpen ? 0 : -1}
            style={{ transitionDelay: menuOpen ? `${80 + i * 60}ms` : "0ms" }}
            onClick={() => {
              setMenuOpen(false);
              scrollToId(link.href.slice(1));
            }}
          >
            <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            {link.label}
          </button>
        ))}
        <Link href="/login" className={styles.navCta} tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>
          Fazer login
          <ArrowRight className={styles.navCtaIcon} aria-hidden />
        </Link>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroBackdrop} aria-hidden>
          <span className={styles.beam} style={{ left: "8%" }} />
          <span className={styles.beam} style={{ left: "31%", animationDelay: "0.4s" }} />
          <span className={styles.beam} style={{ left: "69%", animationDelay: "0.8s" }} />
          <span className={styles.beam} style={{ left: "92%", animationDelay: "1.2s" }} />
          <span className={styles.heroGrid} />
        </div>
        <HeroHologram />
        <section className={styles.heroCopy}>
          <span className={`${styles.heroBadge} ${styles.enter}`} style={{ animationDelay: "0.9s" }}>
            <ShieldCheck aria-hidden />
            Homologada pelo Exército Brasileiro · ABRABLIN
          </span>
          <h1 className={styles.heroTitle} aria-label={TITLE}>
            {TITLE.split(" ").map((word, i) => (
              <span key={i} className={styles.word} aria-hidden>
                <span style={{ animationDelay: `${1.1 + i * 0.09}s` }}>{word}</span>
              </span>
            ))}
          </h1>
          <p className={`${styles.heroLede} ${styles.enter}`} style={{ animationDelay: "1.65s" }}>
            Da chegada à retirada, cada etapa da manutenção vira um evento que você vê acontecer — fotos, laudos e aprovação, sem precisar
            perguntar o que está sendo feito.
          </p>
          <div className={styles.heroActions}>
            <a
              href="#orcamento"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.enter}`}
              style={{ animationDelay: "1.85s" }}
              onClick={(e) => {
                e.preventDefault();
                scrollToId("orcamento");
              }}
            >
              Montar orçamento
              <ArrowRight aria-hidden />
            </a>
            <a
              href="#engenharia"
              className={`${styles.btn} ${styles.btnGhost} ${styles.enter}`}
              style={{ animationDelay: "1.97s" }}
              onClick={(e) => {
                e.preventDefault();
                scrollToId("engenharia");
              }}
            >
              Explorar a engenharia
            </a>
          </div>
        </section>
        <div className={`${styles.scrollCue} ${styles.enter}`} style={{ animationDelay: "2.6s" }} aria-hidden>
          <span />
          Role para explorar
        </div>
      </header>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
