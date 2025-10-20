import Link from "next/link";
import LivroCaixaPanel from "../_components/livro-caixa-panel";
import { prismaWithRetry } from "../../../lib/prisma-retry";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function LivroCaixaPage() {
  const clients = await prismaWithRetry((client) =>
    client.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        cnpj: true,
      },
    }),
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-300/80">Ferramentas</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Livro-caixa</h1>
            <p className="mt-3 text-sm text-slate-300/80">
              Selecione uma empresa autorizado ou cadastre um novo para iniciar os lançamentos financeiros.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-slate-300/80 sm:items-end">
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 font-medium text-slate-100">
              Atualizado em: {formatDateTime(new Date())}
            </span>
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 font-semibold transition hover:border-sky-500 hover:text-sky-300 cursor-pointer"
              href="/admin"
            >
              Voltar para o painel
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-8 py-10">
        <LivroCaixaPanel initialClients={clients} canCreateClients />
      </div>
    </main>
  );
}
