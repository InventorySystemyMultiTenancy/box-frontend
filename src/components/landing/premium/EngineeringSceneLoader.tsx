"use client";

import dynamic from "next/dynamic";
import styles from "./premium.module.css";

// WebGL só no navegador; enquanto carrega, reserva a mesma altura (sem pulo de layout).
const EngineeringScene = dynamic(() => import("./EngineeringScene"), {
  ssr: false,
  loading: () => <section className={styles.engTrack} id="engenharia" aria-hidden />,
});

export default function EngineeringSceneLoader() {
  return <EngineeringScene />;
}
