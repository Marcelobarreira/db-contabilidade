import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "./_components/login-form";
import { prismaWithRetry } from "../lib/prisma-retry";
import { verifyPassword } from "../lib/auth";

type LoginState = {
  error: string;
};

async function loginAction(_: LoginState, formData: FormData): Promise<LoginState | void> {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Preencha e-mail e senha para continuar." };
  }

  const user = await prismaWithRetry((client) => client.user.findUnique({ where: { email } }));

  if (!user || !verifyPassword(password, user.password)) {
    return { error: "Credenciais inválidas. Tente novamente." };
  }

  if (user.admin) {
    redirect("/admin");
  }

  redirect("/dashboard");
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-5xl grid rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.1fr_420px] overflow-hidden">
        <section className="relative hidden lg:flex flex-col gap-10 p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-sky-900/60 to-slate-900" />
          <div className="relative z-10 flex flex-col gap-16">
            <header className="flex justify-between items-start text-sm font-semibold uppercase tracking-[0.4em] text-slate-100/60">
              <span>DB Contabilidade</span>
              <span>Portal</span>
            </header>
            <div className="space-y-6">
              <h1 className="text-4xl font-semibold leading-tight">Contabilidade com confiança e tecnologia</h1>
              <p className="text-slate-100/80 text-lg">
                Centralize obrigações fiscais, acompanhe clientes e visualize indicadores em tempo real. O painel DB
                Contabilidade mantém sua equipe alinhada e os dados seguros.
              </p>
            </div>
            <dl className="space-y-6 text-sm text-slate-100/70">
              <div>
                <dt className="font-semibold text-slate-100">Dashboard inteligente</dt>
                <dd>Resumo contábil, alertas de pendências e calendário fiscal integrado.</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-100">Fluxos automatizados</dt>
                <dd>Envio automático de documentos e sincronização com o sistema financeiro.</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-100">Equipe alinhada</dt>
                <dd>Atribuição de tarefas e histórico consolidado por cliente.</dd>
              </div>
            </dl>
          </div>
          <footer className="relative z-10 text-xs text-slate-100/60">
            © {new Date().getFullYear()} DB Contabilidade. Todos os direitos reservados.
          </footer>
        </section>

        <section className="bg-white/95 text-slate-900 px-8 py-12 sm:px-12 dark:bg-slate-950/90 dark:text-slate-100">
          <div className="mx-auto w-full max-w-sm space-y-10">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold">Acesse sua conta</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Entre com suas credenciais corporativas para chegar ao painel financeiro.
              </p>
            </div>

            <LoginForm action={loginAction} />

            <div className="space-y-3 text-center text-sm text-slate-600 dark:text-slate-400">
              <p>
                É a primeira vez por aqui?
                <Link
                  className="ml-2 font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                  href="/solicitar-acesso"
                >
                  Solicitar acesso
                </Link>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Ao continuar, você concorda com a política de privacidade e termos de uso da DB Contabilidade.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
