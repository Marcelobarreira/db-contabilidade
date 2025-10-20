'use client';

import { useState, useTransition } from "react";

type CompanySummary = {
  id: number;
  name: string;
  cnpj: string;
};

type UserSummary = {
  id: number;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
  admin: boolean;
  companyName: string;
  companyCnpj: string;
};

type UserAccessPanelProps = {
  companies: CompanySummary[];
  initialUsers: UserSummary[];
};

type FormState = {
  email: string;
  cnpj: string;
  temporaryPassword: string;
  admin: boolean;
};

function formatCnpj(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) {
    return raw;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const initialFormState: FormState = {
  email: "",
  cnpj: "",
  temporaryPassword: "",
  admin: false,
};

export default function UserAccessPanel({ companies, initialUsers }: UserAccessPanelProps) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [users, setUsers] = useState<UserSummary[]>(initialUsers);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [isPending, startTransition] = useTransition();

  function handleInputChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleCompanySelect(value: string) {
    handleInputChange("cnpj", value);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback({});

    const payload = {
      email: form.email.trim(),
      cnpj: form.cnpj.trim(),
      temporaryPassword: form.temporaryPassword.trim(),
      admin: form.admin,
    };

    if (!payload.email || !payload.temporaryPassword) {
      setFeedback({ error: "Preencha e-mail e senha temporaria para criar o acesso." });
      return;
    }

    if (!payload.admin && !payload.cnpj) {
      setFeedback({ error: "Informe o CNPJ da empresa para criar um acesso comum." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Erro inesperado ao criar usuário." }));
          setFeedback({ error: body.error ?? "Não foi possível criar o usuário." });
          return;
        }

        const createdUser = await response.json();

        setUsers((prev) => [
          {
            id: createdUser.id,
            email: createdUser.email,
            admin: createdUser.admin,
            mustChangePassword: createdUser.mustChangePassword,
            createdAt: createdUser.createdAt,
            companyName: createdUser.company?.name ?? "Equipe interna",
            companyCnpj: createdUser.company?.cnpj ?? "—",
          },
          ...prev,
        ]);

        setForm(initialFormState);
        setFeedback({
          success: createdUser.admin
            ? "Acesso administrativo criado com sucesso. Compartilhe a senha temporaria com o administrador."
            : "Acesso criado com sucesso. Envie as credenciais temporarias ao contato da empresa.",
        });
      } catch (error) {
        console.error("Erro ao criar usuário comum", error);
        setFeedback({ error: "Não foi possível criar o usuário. Tente novamente em instantes." });
      }
    });
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-white/5 space-y-10">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Criar acesso de usuário</h2>
        <p className="text-sm text-slate-300/80">
          Conceda acesso ao portal para empresas e colaboradores. A senha temporária exigirá redefinição no primeiro login.
        </p>
      </header>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Tipo de acesso</span>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-500 hover:text-sky-300 cursor-pointer">
              <input
                type="radio"
                name="access-type"
                className="h-4 w-4 text-sky-500 focus:ring-sky-500"
                checked={!form.admin}
                onChange={() => handleInputChange("admin", false)}
              />
              Usuário comum
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-500 hover:text-sky-300 cursor-pointer">
              <input
                type="radio"
                name="access-type"
                className="h-4 w-4 text-sky-500 focus:ring-sky-500"
                checked={form.admin}
                onChange={() => handleInputChange("admin", true)}
              />
              Administrador
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="user-email">
              E-mail do usuário
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
              id="user-email"
              name="user-email"
              type="email"
              placeholder="usuario@empresa.com.br"
              value={form.email}
              onChange={(event) => handleInputChange("email", event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="user-cnpj">
              CNPJ da empresa
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
              id="user-cnpj"
              name="user-cnpj"
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={(event) => handleInputChange("cnpj", event.target.value)}
              disabled={form.admin}
              required={!form.admin}
            />
            <p className="text-xs text-slate-500">
              {form.admin
                ? "Para administradores o CNPJ não é necessário."
                : "Você pode copiar o CNPJ diretamente da lista de empresas abaixo."}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="user-temp-password">
            Senha temporária
          </label>
          <input
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
            id="user-temp-password"
            name="user-temp-password"
            type="text"
            placeholder="Senha inicial provisória"
            value={form.temporaryPassword}
            onChange={(event) => handleInputChange("temporaryPassword", event.target.value)}
            required
          />
          <p className="text-xs text-slate-500">
            O usuário será obrigado a definir uma nova senha assim que acessar o portal.
          </p>
        </div>

        {feedback.error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{feedback.error}</p>
        ) : null}
        {feedback.success ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {feedback.success}
          </p>
        ) : null}

        <div className="flex items-center justify-end">
          <button
            className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Criando acesso..." : "Criar acesso"}
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Empresas cadastradas</h3>
            <p className="text-xs text-slate-400">
              Utilize os CNPJs abaixo para associar acessos às respectivas empresas.
            </p>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          {companies.length > 0 ? (
            companies.map((company) => (
              <button
                key={company.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-sky-500 hover:text-sky-200"
                type="button"
                onClick={() => handleCompanySelect(formatCnpj(company.cnpj))}
              >
                <span>
                  <p className="font-semibold text-white">{company.name}</p>
                  <p className="text-xs text-slate-400">{formatCnpj(company.cnpj)}</p>
                </span>
                <span className="text-xs text-slate-500">Usar CNPJ</span>
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-400">Nenhuma empresa cadastrada até o momento.</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Últimos acessos criados</h3>
            <p className="text-xs text-slate-400">Acompanhe quem ainda precisa definir uma senha definitiva.</p>
          </div>
        </header>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">
                <tr>
                  <th className="px-4 py-3 text-left">E-mail</th>
                  <th className="px-4 py-3 text-left">Perfil</th>
                  <th className="px-4 py-3 text-left">Empresa</th>
                  <th className="px-4 py-3 text-left">Criado em</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">{user.admin ? "Administrador" : "Usuário"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span>{user.companyName}</span>
                          <span className="text-xs text-slate-400">{formatCnpj(user.companyCnpj)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatDateTime(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        {user.mustChangePassword ? (
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                            Aguardando troca
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                            Ativo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={4}>
                      Nenhum acesso criado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  );
}
