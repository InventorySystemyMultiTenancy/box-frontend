# BOX. — Frontend

Landing page + área do cliente da plataforma de acompanhamento de manutenção, implementadas a
partir de `especificacao-experiencia-digital.html`. Deploy alvo: **Vercel**.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- React Three Fiber / drei / three — hero 3D (carro construído com geometria primitiva, sem
  asset externo — pronto para ser substituído por um `.glb` profissional)
- Socket.io client — timeline, status, peças e aprovações em tempo real
- CSS Modules com os tokens de design da especificação (`src/app/globals.css`)

## Como rodar localmente

O backend (`backendmecanic`) precisa estar rodando em `http://localhost:4000` (ver README dele).

```bash
npm install
cp .env.example .env.local   # já aponta para o backend local
npm run dev                   # http://localhost:3000
```

Login de demonstração (criado pelo seed do backend): `cliente@box.demo` / `cliente123`.

## Estrutura

```
src/
  app/
    page.tsx           # landing page (hero 3D + seções)
    login/page.tsx
    dashboard/page.tsx  # área do cliente (protegida, client-side)
    layout.tsx
    globals.css          # tokens de design
  components/
    landing/             # Hero3D, seções da landing, animações de entrada
    dashboard/            # status, timeline, esquema do veículo, aprovação
  lib/
    api.ts                # cliente HTTP para o backend
    auth-context.tsx        # sessão do cliente (token em localStorage)
    socket.ts                # cliente Socket.io
    types.ts                  # espelha src/lib/constants.ts do backend
```

## Variáveis de ambiente

| Nome | Uso |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL do backend (Express). Em produção, aponta para o serviço publicado no Render. |

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Defina `NEXT_PUBLIC_API_URL` nas variáveis de ambiente do projeto, apontando para a URL
   pública do backend no Render (ex.: `https://box-backend.onrender.com`).
3. Build command e output ficam nos padrões do Next.js — nada extra a configurar.

## Notas de implementação

- O hero 3D só carrega no cliente (`next/dynamic` com `ssr: false`) para não pesar o bundle
  inicial do servidor, conforme a seção de performance da especificação.
- Toda animação respeita `prefers-reduced-motion`: a entrada do hero e as revelações de
  seção caem para estado final estático, sem transição.
- O esquema do veículo no dashboard (`components/dashboard/VehicleSchematic.tsx`) só desenha
  pontos para os componentes que a ordem de serviço realmente possui — nada de placeholder vazio.
