import Link from "next/link";
import UserAccessPanel from "../_components/user-access-panel";
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

export default async function UsuariosPage() {
  const [companies, users] = await Promise.all([
    prismaWithRetry((client) =>
      client.company.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          cnpj: true,
        },
      }),
    ),
    prismaWithRetry((client) =>
      client.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          email: true,
          admin: true,
          mustChangePassword: true,
          createdAt: true,
          company: {
            select: {
              name: true,
              cnpj: true,
            },
          },
        },
      }),
    ),
  ]);

  const userSummaries = users.map((user) => ({
    id: user.id,
    email: user.email,
    admin: user.admin,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    companyName: user.company?.name ?? "Equipe interna",
    companyCnpj: user.company?.cnpj ?? "-",
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-300/80">Ferramentas</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Gerenciar acessos</h1>
            <p className="mt-3 text-sm text-slate-300/80">
              Crie usuários comuns ou administradores com senha temporária e acompanhe quem ainda precisa definir uma credencial definitiva.
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

      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <UserAccessPanel companies={companies} initialUsers={userSummaries} />
      </div>
    </main>
  );
}
