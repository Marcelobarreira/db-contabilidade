'use client';

import { useFormState, useFormStatus } from "react-dom";

type ResetState = {
  error: string;
};

type SetPasswordFormProps = {
  token: string;
  action: (state: ResetState, formData: FormData) => Promise<ResetState | void>;
};

const initialState: ResetState = {
  error: "",
};

export default function SetPasswordForm({ token, action }: SetPasswordFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const errorMessage = typeof state === "object" && state !== null ? state.error : "";

  return (
    <form action={formAction} className="space-y-6 max-w-md">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="password">
          Nova senha
        </label>
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Crie uma nova senha"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="confirmPassword">
          Confirmar senha
        </label>
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          required
        />
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Salvando..." : "Definir senha"}
    </button>
  );
}
