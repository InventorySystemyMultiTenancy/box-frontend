"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

type FloatingBar = { left: number; width: number; scrollWidth: number }

// Container com rolagem horizontal cuja barra de rolagem "gruda" no rodapé da tela:
// quando a tabela é mais larga que a área e o fim dela (onde fica a barra nativa)
// está abaixo da dobra, mostramos uma barra fixa no rodapé da janela, sincronizada
// com o container — assim dá pra arrastar pro lado sem precisar rolar até o fim.
function ScrollX({ className, children, ...props }: React.ComponentProps<"div">) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const barRef = React.useRef<HTMLDivElement>(null)
  const [bar, setBar] = React.useState<FloatingBar | null>(null)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let frame = 0

    function update() {
      frame = 0
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const overflows = el.scrollWidth > el.clientWidth + 1
      // Só aparece com parte da tabela na tela e a barra nativa (no fim dela) escondida.
      const show = overflows && rect.top < viewportHeight - 48 && rect.bottom > viewportHeight
      setBar((prev) => {
        if (!show) return null
        const next = { left: rect.left, width: rect.width, scrollWidth: el.scrollWidth }
        if (prev && prev.left === next.left && prev.width === next.width && prev.scrollWidth === next.scrollWidth) return prev
        return next
      })
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    // capture: pega rolagem da janela e de qualquer ancestral rolável.
    window.addEventListener("scroll", schedule, true)
    window.addEventListener("resize", schedule)
    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    // O conteúdo pode trocar depois (ex.: "Carregando..." → tabela): passa a observar o novo filho.
    const mutations = new MutationObserver(() => {
      if (el.firstElementChild) observer.observe(el.firstElementChild)
      schedule()
    })
    mutations.observe(el, { childList: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
      observer.disconnect()
      mutations.disconnect()
    }
  }, [])

  // Ao surgir, a barra flutuante parte da posição atual do container.
  React.useLayoutEffect(() => {
    if (bar && barRef.current && containerRef.current) {
      barRef.current.scrollLeft = containerRef.current.scrollLeft
    }
  }, [bar])

  function syncFromContainer() {
    const el = containerRef.current
    const floating = barRef.current
    if (el && floating && floating.scrollLeft !== el.scrollLeft) floating.scrollLeft = el.scrollLeft
  }

  function syncFromBar() {
    const el = containerRef.current
    const floating = barRef.current
    if (el && floating && el.scrollLeft !== floating.scrollLeft) el.scrollLeft = floating.scrollLeft
  }

  return (
    <>
      <div
        ref={containerRef}
        onScroll={syncFromContainer}
        className={cn("relative w-full overflow-x-auto", className)}
        {...props}
      >
        {children}
      </div>
      {bar &&
        createPortal(
          <div
            ref={barRef}
            onScroll={syncFromBar}
            aria-hidden
            className="floating-scrollbar"
            style={{ left: bar.left, width: bar.width }}
          >
            <div style={{ width: bar.scrollWidth, height: 1 }} />
          </div>,
          document.body
        )}
    </>
  )
}

export { ScrollX }
