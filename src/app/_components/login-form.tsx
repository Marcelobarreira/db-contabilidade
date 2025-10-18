'use client';

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

type LoginFormState = {
  error: string;
};

type LoginFormProps = {
  action: (state: LoginFormState, formData: FormData) => Promise<LoginFormState | void>;
};

const initialState: LoginFormState = { error: "" };

export default function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">
          E-mail corporativo
        </label>
        <input
          className="w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-sky-400"
          id="email"
          name="email"
          type="email"
          placeholder="seu.nome@dbcontabilidade.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
          Senha
        </label>
        <input
          className="w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-sky-400"
          id="password"
          name="password"
          type="password"
          placeholder="Digite sua senha"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400" htmlFor="remember">
          <input
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
            id="remember"
            name="remember"
            type="checkbox"
          />
          Manter conectado
        </label>
        <Link
          className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
          href="#"
        >
          Esqueci minha senha
        </Link>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? "Verificando..." : "Entrar"}
    </button>
  );
}
