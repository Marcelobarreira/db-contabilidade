import { redirect } from "next/navigation";
import SetPasswordForm from "../_components/set-password-form";
import { prismaWithRetry } from "../../lib/prisma-retry";
import { hashPassword } from "../../lib/auth";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

type ResetState = {
  error: string;
};

async function resetPasswordAction(_: ResetState, formData: FormData): Promise<ResetState | void> {
  "use server";

  const token = formData.get("token");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof token !== "string" || !token) {
    return { error: "Link inválido ou expirado." };
  }

  if (typeof password !== "string" || password.length < 8) {
    return { error: "A nova senha deve ter pelo menos 8 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "As senhas precisam ser iguais." };
  }

  const user = await prismaWithRetry((client) =>
    client.user.findUnique({
      where: { passwordResetToken: token },
      select: { id: true },
    }),
  );

  if (!user) {
    return { error: "Link inválido ou expirado." };
  }

  const hashedPassword = hashPassword(password);

  await prismaWithRetry((client) =>
    client.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        passwordResetToken: null,
      },
    }),
  );

  redirect("/?senhaAtualizada=1");
}

export default async function DefinirSenhaPage({ searchParams }: PageProps) {
  const tokenParam = searchParams.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam ?? "";

  const user = token
    ? await prismaWithRetry((client) =>
        client.user.findUnique({
          where: { passwordResetToken: token },
          select: { email: true, company: { select: { name: true } } },
        }),
      )
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Primeiro acesso</p>
          <h1 className="text-3xl font-semibold text-white">Definir nova senha</h1>
          <p className="text-sm text-slate-300/80">
            Por segurança, defina uma senha definitiva antes de entrar no portal DB Contabilidade.
          </p>
        </header>

        {token && user ? (
          <div className="space-y-8">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-sm text-slate-200">
              <p>
                Acesso:&nbsp;
                <strong className="font-semibold text-white">{user.email}</strong>
              </p>
              {user.company ? (
                <p className="text-slate-400">
                  Empresa:&nbsp;
                  <strong className="font-semibold text-slate-200">{user.company.name}</strong>
                </p>
              ) : null}
            </div>

            <SetPasswordForm action={resetPasswordAction} token={token} />
          </div>
        ) : (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            O link informado não é válido ou já foi utilizado. Solicite um novo acesso ao administrador.
          </div>
        )}
      </div>
    </main>
  );
}
