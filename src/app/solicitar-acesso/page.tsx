import Link from "next/link";

const campos = [
  { id: "name", label: "Nome completo", type: "text", placeholder: "Digite seu nome" },
  { id: "email", label: "E-mail corporativo", type: "email", placeholder: "voce@empresa.com" },
  { id: "phone", label: "Telefone/WhatsApp", type: "tel", placeholder: "(11) 99999-0000" },
  { id: "company", label: "Empresa", type: "text", placeholder: "Razão social ou fantasia" },
];

export default function RequestAccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-5xl grid rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.1fr_420px] overflow-hidden">
        <section className="relative hidden lg:flex flex-col gap-12 p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-900 via-blue-900/60 to-slate-950" />
          <div className="relative z-10 flex flex-col gap-10">
            <header className="flex items-center justify-between text-sm font-semibold uppercase tracking-[0.4em] text-slate-100/60">
              <span>Brunocont</span>
              <span>Acesso</span>
            </header>
            <div className="space-y-6">
              <h1 className="text-4xl font-semibold leading-tight">
                Solicite acesso ao ecossistema contábil Brunocont
              </h1>
              <p className="text-slate-100/80 text-lg">
                Conecte sua empresa a uma contabilidade data-driven. Automatize obrigações, acompanhe indicadores e
                colabore em tempo real com especialistas.
              </p>
            </div>
            <ol className="space-y-4 text-sm text-slate-100/80">
              <li>
                <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-100/50">1.</span>
                Complete o formulário com os dados da sua empresa.
              </li>
              <li>
                <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-100/50">2.</span>
                Nossa equipe valida documentos e configura o espaço seguro.
              </li>
              <li>
                <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-100/50">3.</span>
                Receba o credenciamento e comece a operar em até 24h úteis.
              </li>
            </ol>
          </div>
          <footer className="relative z-10 text-xs text-slate-100/60">
            Em caso de urgência, escreva para{" "}
            <a className="underline decoration-dotted hover:text-slate-100" href="mailto:contato@brunocont.com">
              contato@brunocont.com
            </a>
            .
          </footer>
        </section>

        <section className="bg-white/95 text-slate-900 px-8 py-12 sm:px-12 dark:bg-slate-950/90 dark:text-slate-100">
          <div className="mx-auto w-full max-w-sm space-y-10">
            <div className="space-y-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
                onboarding
              </p>
              <h2 className="text-2xl font-semibold">Solicitar acesso</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Envie seus dados e retornaremos com o credenciamento em até um dia útil.
              </p>
            </div>

            <form className="space-y-5">
              {campos.map((campo) => (
                <div className="space-y-2" key={campo.id}>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor={campo.id}>
                    {campo.label}
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-sky-400"
                    id={campo.id}
                    name={campo.id}
                    type={campo.type}
                    placeholder={campo.placeholder}
                    required
                  />
                </div>
              ))}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="message">
                  Conte um pouco sobre a sua necessidade
                </label>
                <textarea
                  className="h-28 w-full resize-none rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-sky-400"
                  id="message"
                  name="message"
                  placeholder="Quais rotinas gostaria de automatizar? Quantos usuários estimados?"
                  required
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400" htmlFor="terms">
                <input
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                />
                <span>
                  Concordo em compartilhar meus dados de contato para receber informações sobre o painel Brunocont e
                  autorizo a equipe a entrar em contato.
                </span>
              </label>

              <button
                className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/30 dark:bg-sky-500 dark:hover:bg-sky-400"
                type="submit"
              >
                Enviar solicitação
              </button>
            </form>

            <div className="space-y-3 text-center text-sm text-slate-600 dark:text-slate-400">
              <p>
                Já possui credenciais?
                <Link
                  className="ml-2 font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                  href="/"
                >
                  Voltar para o login
                </Link>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Ao enviar, você concorda com nossos termos de uso e política de privacidade.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
