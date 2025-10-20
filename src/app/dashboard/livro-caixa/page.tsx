import LivroCaixaPanel from "../../admin/_components/livro-caixa-panel";
import { prismaWithRetry } from "../../../lib/prisma-retry";
import { getSession } from "../../../lib/session";
import { redirect } from "next/navigation";

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

  const clients = await prismaWithRetry((client) =>
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

  if (!clients.length) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <LivroCaixaPanel initialClients={clients} canCreateClients={false} />
      </div>
    </main>
  );
}
