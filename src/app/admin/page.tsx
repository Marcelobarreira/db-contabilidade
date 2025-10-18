import { prismaWithRetry } from "../../lib/prisma-retry";
import Link from "next/link";
import Image from "next/image";

type ClientSummary = {
  id: number;
  name: string;
  email: string;
  cnpj: string;
  createdAt: Date;
};

function formatCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) {
    return cnpj;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminDashboard() {
  const [clients, totalUsers, adminUsers] = await Promise.all([
    prismaWithRetry((client) =>
      client.company.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          cnpj: true,
          createdAt: true,
        },
      }),
    ),
    prismaWithRetry((client) => client.user.count()),
    prismaWithRetry((client) => client.user.count({ where: { admin: true } })),
  ]);

  const clientsSummary: ClientSummary[] = clients.map((client) => ({
    ...client,
    cnpj: client.cnpj,
  }));

  const totalClients = clientsSummary.length;
  const totalColaboradores = totalUsers;
  const totalAdministradores = adminUsers;

  const recentClients = clientsSummary
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);
  const generatedAt = new Date();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/dbcontabilidade.jpg"
              alt="DB Contabilidade"
              width={56}
              height={56}
              className="h-14 w-14 rounded-2xl border border-white/10 bg-white object-cover"
              priority
            />
            <div>
              
              <p className="text-sm text-slate-300/80">Painel de Controle Administrativo</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-300/80 sm:flex-row sm:items-center sm:gap-6">
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 font-medium text-slate-100">
              Atualizado em: {formatDateTime(generatedAt)}
            </span>
            <div className="flex items-center gap-3">
              <Link
                className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-500 hover:text-sky-300 cursor-pointer"
                href="/admin/livro-caixa"
              >
                Livro-caixa
              </Link>
              <Link
                className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-500 hover:text-sky-300 cursor-pointer"
                href="/admin/usuarios"
              >
                Acessos
              </Link>
              <button className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 font-semibold transition hover:border-sky-500 hover:text-sky-300">
                Configuracoes
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-white/5">
            <p className="text-sm font-medium text-slate-300/80">Clientes ativos</p>
            <p className="mt-3 text-3xl font-semibold text-white">{totalClients}</p>
            <p className="mt-4 text-xs text-slate-400">
              Total de empresas cadastradas para operacoes no portal.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-white/5">
            <p className="text-sm font-medium text-slate-300/80">Usuarios cadastrados</p>
            <p className="mt-3 text-3xl font-semibold text-white">{totalColaboradores}</p>
            <p className="mt-4 text-xs text-slate-400">
              Contagem geral de acessos vinculados a DB Contabilidade.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-white/5">
            <p className="text-sm font-medium text-slate-300/80">Administradores</p>
            <p className="mt-3 text-3xl font-semibold text-white">{totalAdministradores}</p>
            <p className="mt-4 text-xs text-slate-400">
              Usuarios com acesso total a gestao de clientes e configuracoes.
            </p>
          </article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-white/5">
          <header className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Clientes recentes</h2>
              <p className="text-sm text-slate-300/80">
                Ultimas empresas cadastradas no portal.
              </p>
            </div>
          </header>

          {recentClients.length > 0 ? (
            <ul className="mt-6 space-y-4">
              {recentClients.map((client) => (
                <li
                  key={client.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{client.name}</p>
                    <p className="text-xs text-slate-400">{client.email}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:gap-4">
                    <span className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 font-semibold tracking-wide text-slate-200">
                      {formatCnpj(client.cnpj)}
                    </span>
                    <span>
                      Criado em:&nbsp;
                      <strong className="font-semibold text-slate-200">{formatDate(client.createdAt)}</strong>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-slate-300/80">
              Nenhum cliente cadastrado ate o momento. Utilize o botao &ldquo;Novo cliente&rdquo; para comecar.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
