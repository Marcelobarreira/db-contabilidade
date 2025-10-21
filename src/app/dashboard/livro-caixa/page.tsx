import Link from "next/link";
import Image from "next/image";
import LivroCaixaPanel from "../../admin/_components/livro-caixa-panel";
import LogoutButton from "../../_components/logout-button";
import { prismaWithRetry } from "../../../lib/prisma-retry";
import { getSession } from "../../../lib/session";
import { redirect } from "next/navigation";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) {
    return cnpj;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export default async function ClientLivroCaixaPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (session.admin) {
    redirect("/admin/livro-caixa");
  }

  if (session.companyId == null) {
    redirect("/dashboard");
  }

  const companies = await prismaWithRetry((client) =>
    client.company.findMany({
      where: { id: session.companyId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        cnpj: true,
      },
    }),
  );

  if (!companies.length) {
    redirect("/dashboard");
  }

  const company = companies[0];
  const formattedCnpj = formatCnpj(company.cnpj);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="flex items-center gap-4">
            <Image
              src="/dbcontabilidade.jpg"
              alt="DB Contabilidade"
              width={56}
              height={56}
              className="h-14 w-14 rounded-2xl border border-white/10 bg-white object-cover"
              priority
            />
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-300/80">Área da empresa</p>
              <h1 className="text-3xl font-semibold text-white">{company.name}</h1>
              <p className="text-sm text-slate-300/80">CNPJ {formattedCnpj}</p>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-300/80">
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 font-medium text-slate-100">
              Atualizado em: {formatDate(new Date())}
            </span>
            <LogoutButton className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 font-semibold text-slate-100 transition hover:border-red-500 hover:text-red-200">
              Sair
            </LogoutButton>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-8 py-10">
        <LivroCaixaPanel initialClients={companies} canCreateClients={false} />
      </div>
    </main>
  );
}
