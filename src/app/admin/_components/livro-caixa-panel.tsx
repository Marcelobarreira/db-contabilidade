'use client';

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";

type Client = {
  id: number;
  name: string;
  email: string;
  cnpj: string;
};

type CashEntry = {
  id: number;
  companyId: number;
  date: string;
  counterpart: string;
  productService: string;
  movement: MovementOption;
  type: ActivityOption;
  paymentMethod: string;
  amount: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

type LivroCaixaPanelProps = {
  initialClients: Client[];
};

type ClientFormState = {
  name: string;
  email: string;
  cnpj: string;
};

type EntryFormState = {
  date: string;
  movement: MovementOption;
  counterpart: string;
  productService: string;
  type: ActivityOption;
  paymentMethod: string;
  amount: string;
  notes: string;
};

type MovementOption = "RECEITA" | "COMPRA" | "DESPESA" | "RETIRADA";
type ActivityOption = "COMERCIO" | "INDUSTRIA" | "SERVICO" | "TRANSPORTE";

const MOVEMENT_OPTIONS: { value: MovementOption; label: string }[] = [
  { value: "RECEITA", label: "Receita" },
  { value: "COMPRA", label: "Compra" },
  { value: "DESPESA", label: "Despesa" },
  { value: "RETIRADA", label: "Retirada" },
];

const ACTIVITY_OPTIONS: { value: ActivityOption; label: string }[] = [
  { value: "COMERCIO", label: "Comércio" },
  { value: "INDUSTRIA", label: "Indústria" },
  { value: "SERVICO", label: "Serviço" },
  { value: "TRANSPORTE", label: "Transporte" },
];

const initialClientForm: ClientFormState = {
  name: "",
  email: "",
  cnpj: "",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) {
    return cnpj;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatDateShort(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function normalizeAmountInput(value: string) {
  return value.replace(/[^\d.,-]/g, "");
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
}

function createInitialEntryForm(): EntryFormState {
  return {
    date: formatDateInput(new Date()),
    movement: "RECEITA",
    counterpart: "",
    productService: "",
    type: "COMERCIO",
    paymentMethod: "",
    amount: "",
    notes: "",
  };
}

export default function LivroCaixaPanel({ initialClients }: LivroCaixaPanelProps) {
  const [clients, setClients] = useState<Client[]>(
    initialClients.map((client) => ({
      ...client,
      cnpj: client.cnpj.replace(/\D/g, ""),
    })),
  );
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<ClientFormState>(initialClientForm);
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [isCreatingClient, startCreateClientTransition] = useTransition();

  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [isFetchingEntries, setIsFetchingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [filters, setFilters] = useState(() => {
    const { start, end } = getCurrentMonthRange();
    return { startDate: start, endDate: end };
  });

  const [entryForm, setEntryForm] = useState<EntryFormState>(() => createInitialEntryForm());
  const [entryFormError, setEntryFormError] = useState<string | null>(null);
  const [isCreatingEntry, startCreateEntryTransition] = useTransition();

  useEffect(() => {
    if (typeof selectedClientId !== "number") {
      setEntries([]);
      return;
    }

    let cancelled = false;
    setIsFetchingEntries(true);
    setEntriesError(null);

    (async () => {
      try {
        const response = await fetch(`/api/clients/${selectedClientId}/cash-entries`, {
          method: "GET",
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Falha ao carregar lançamentos." }));
          throw new Error(body.error ?? "Falha ao carregar lançamentos.");
        }

        const data = (await response.json()) as CashEntry[];
        if (!cancelled) {
          setEntries(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Erro ao buscar lançamentos", error);
          setEntriesError("Não foi possível carregar os lançamentos deste cliente.");
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setIsFetchingEntries(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  const formattedClients = useMemo(
    () =>
      clients
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((client) => ({
          ...client,
          formattedCnpj: formatCnpj(client.cnpj),
        })),
    [clients],
  );

  const selectedClient =
    typeof selectedClientId === "number"
      ? formattedClients.find((client) => client.id === selectedClientId) ?? null
      : null;

  const filteredEntries = useMemo(() => {
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;
    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    return entries.filter((entry) => {
      const entryDate = new Date(entry.date);
      if (start && entryDate < start) {
        return false;
      }
      if (end && entryDate > end) {
        return false;
      }
      return true;
    });
  }, [entries, filters]);

  const enhancedEntries = useMemo(() => {
    let running = 0;

    return filteredEntries
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((entry) => {
        const multiplier = entry.movement === "RECEITA" ? 1 : -1;
        running += entry.amount * multiplier;

        return {
          ...entry,
          runningBalance: running,
          displayAmount:
            entry.movement === "RECEITA"
              ? currencyFormatter.format(entry.amount)
              : `-${currencyFormatter.format(entry.amount)}`,
        };
      });
  }, [filteredEntries]);

  const totals = useMemo(() => {
    return enhancedEntries.reduce(
      (acc, entry) => {
        const amount = entry.amount;
        switch (entry.movement) {
          case "RECEITA":
            acc.entradas += amount;
            break;
          case "DESPESA":
            acc.despesas += amount;
            break;
          case "COMPRA":
            acc.compras += amount;
            break;
          case "RETIRADA":
            acc.retiradas += amount;
            break;
          default:
            break;
        }
        return acc;
      },
      { entradas: 0, despesas: 0, compras: 0, retiradas: 0 },
    );
  }, [enhancedEntries]);

  const totalBalance = totals.entradas - totals.despesas - totals.compras - totals.retiradas;

  function handleClientModalClose() {
    setClientModalOpen(false);
    setClientForm(initialClientForm);
    setClientFormError(null);
  }

  function handleClientFormChange(field: keyof ClientFormState, value: string) {
    setClientForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleEntryFormChange<K extends keyof EntryFormState>(field: K, value: string) {
    setEntryForm((prev) => ({
      ...prev,
      [field]: field === "amount" ? normalizeAmountInput(value) : value,
    }));
  }

  function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: clientForm.name.trim(),
      email: clientForm.email.trim(),
      cnpj: clientForm.cnpj.trim(),
    };

    if (!payload.name || !payload.email || !payload.cnpj) {
      setClientFormError("Preencha todos os campos para criar o cliente.");
      return;
    }

    startCreateClientTransition(async () => {
      try {
        const response = await fetch("/api/clients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Erro inesperado." }));
          setClientFormError(body.error ?? "Não foi possível criar o cliente.");
          return;
        }

        const createdClient: Client = await response.json();
        setClients((prev) => [...prev, { ...createdClient, cnpj: createdClient.cnpj.replace(/\D/g, "") }]);
        setSelectedClientId(createdClient.id);
        handleClientModalClose();
      } catch (error) {
        console.error("Erro ao criar cliente", error);
        setClientFormError("Não foi possível criar o cliente. Tente novamente.");
      }
    });
  }

  function handleCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (typeof selectedClientId !== "number") {
      setEntryFormError("Selecione um cliente antes de adicionar o lançamento.");
      return;
    }

    const payload = {
      ...entryForm,
      amount: entryForm.amount.replace(/\./g, "").replace(",", "."),
      notes: entryForm.notes.trim(),
    };

    if (!payload.date || !payload.counterpart || !payload.productService || !payload.paymentMethod || !payload.amount) {
      setEntryFormError("Preencha todos os campos obrigatórios.");
      return;
    }

    setEntryFormError(null);

    startCreateEntryTransition(async () => {
      try {
        const response = await fetch(`/api/clients/${selectedClientId}/cash-entries`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...payload,
            notes: payload.notes || undefined,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Não foi possível salvar o lançamento." }));
          setEntryFormError(body.error ?? "Não foi possível salvar o lançamento.");
          return;
        }

        const createdEntry = (await response.json()) as CashEntry;
        setEntries((prev) => [...prev, createdEntry]);
        setEntryForm(createInitialEntryForm());
      } catch (error) {
        console.error("Erro ao criar lançamento", error);
        setEntryFormError("Não foi possível salvar o lançamento. Tente novamente.");
      }
    });
  }

  const hasClients = formattedClients.length > 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-white/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Livro-caixa</h2>
          <p className="text-sm text-slate-300/80">
            Selecione um cliente para gerenciar lançamentos ou cadastre um novo.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          type="button"
          onClick={() => setClientModalOpen(true)}
        >
          Novo cliente
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-200" htmlFor="client">
          Cliente
        </label>
        <select
          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:opacity-60"
          disabled={hasClients === false}
          id="client"
          value={selectedClientId}
          onChange={(event) => {
            const value = event.target.value;
            setSelectedClientId(value ? Number(value) : "");
          }}
        >
          {hasClients ? (
            <>
              <option value="">Selecione um cliente</option>
              {formattedClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.formattedCnpj}
                </option>
              ))}
            </>
          ) : (
            <option value="">Nenhum cliente cadastrado</option>
          )}
        </select>

        {selectedClient ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
            <p className="font-semibold">{selectedClient.name}</p>
            <p className="text-xs text-slate-400">E-mail:&nbsp;{selectedClient.email}</p>
            <p className="text-xs text-slate-400">CNPJ:&nbsp;{selectedClient.formattedCnpj}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Escolha um cliente ou cadastre um novo para acessar o livro-caixa.
          </p>
        )}
      </div>

      {selectedClient ? (
        <div className="mt-10 space-y-10">
          <section className="space-y-6">
            <header className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Lançamentos</h3>
              <p className="text-sm text-slate-300/80">
                O livro-caixa é a ferramenta de controle financeiro do cliente. Acompanhe os lançamentos e filtre por data.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="start-date">
                  Data inicial
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                  id="start-date"
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="end-date">
                  Data final
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                  id="end-date"
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Cliente / Fornecedor</th>
                      <th className="px-4 py-3 text-left">Produto / Serviço</th>
                      <th className="px-4 py-3 text-left">Movimentação</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Valor</th>
                      <th className="px-4 py-3 text-left">Forma de pagamento</th>
                      <th className="px-4 py-3 text-left">Saldo acumulado</th>
                      <th className="px-4 py-3 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm text-slate-200">
                    {isFetchingEntries ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={9}>
                          Carregando lançamentos...
                        </td>
                      </tr>
                    ) : entriesError ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-red-300" colSpan={9}>
                          {entriesError}
                        </td>
                      </tr>
                    ) : enhancedEntries.length > 0 ? (
                      enhancedEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-900/60">
                          <td className="px-4 py-3">{formatDateShort(entry.date)}</td>
                          <td className="px-4 py-3">{entry.counterpart}</td>
                          <td className="px-4 py-3">{entry.productService}</td>
                          <td className="px-4 py-3">
                            {MOVEMENT_OPTIONS.find((option) => option.value === entry.movement)?.label ?? entry.movement}
                          </td>
                          <td className="px-4 py-3">
                            {ACTIVITY_OPTIONS.find((option) => option.value === entry.type)?.label ?? entry.type}
                          </td>
                          <td className="px-4 py-3 font-semibold">{entry.displayAmount}</td>
                          <td className="px-4 py-3">{entry.paymentMethod}</td>
                          <td className="px-4 py-3 font-semibold">
                            {currencyFormatter.format(entry.runningBalance)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">—</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={9}>
                          Nenhum lançamento registrado para o período selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-6">
                <span>
                  Entradas:&nbsp;
                  <strong className="text-sky-300">{currencyFormatter.format(totals.entradas)}</strong>
                </span>
                <span>
                  Despesas:&nbsp;
                  <strong className="text-red-300">{currencyFormatter.format(totals.despesas)}</strong>
                </span>
                <span>
                  Compras:&nbsp;
                  <strong className="text-amber-300">{currencyFormatter.format(totals.compras)}</strong>
                </span>
                <span>
                  Retiradas:&nbsp;
                  <strong className="text-pink-300">{currencyFormatter.format(totals.retiradas)}</strong>
                </span>
              </div>
              <div className="text-base font-semibold">
                Total:&nbsp;
                <span className={totalBalance >= 0 ? "text-sky-300" : "text-red-300"}>
                  {currencyFormatter.format(totalBalance)}
                </span>
              </div>
            </aside>
          </section>

          <section className="space-y-6 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <header className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Adicionar lançamento</p>
              <h3 className="text-xl font-semibold text-white">Registrar movimentação financeira</h3>
              <p className="text-sm text-slate-300/80">
                Preencha os campos abaixo para adicionar um novo lançamento ao livro-caixa do cliente selecionado.
              </p>
            </header>

            <form className="space-y-5" onSubmit={handleCreateEntry}>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry-date">
                    Data
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-date"
                    name="entry-date"
                    type="date"
                    value={entryForm.date}
                    onChange={(event) => handleEntryFormChange("date", event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-1">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry-movement">
                    Movimentação
                  </label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-movement"
                    name="entry-movement"
                    value={entryForm.movement}
                    onChange={(event) => handleEntryFormChange("movement", event.target.value)}
                    required
                  >
                    {MOVEMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-1">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry-type">
                    Tipo
                  </label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-type"
                    name="entry-type"
                    value={entryForm.type}
                    onChange={(event) => handleEntryFormChange("type", event.target.value)}
                    required
                  >
                    {ACTIVITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry-counterpart">
                    Cliente ou fornecedor
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-counterpart"
                    name="entry-counterpart"
                    placeholder="Nome do cliente ou fornecedor"
                    value={entryForm.counterpart}
                    onChange={(event) => handleEntryFormChange("counterpart", event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry-product">
                    Produto / serviço
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-product"
                    name="entry-product"
                    placeholder="Descrição"
                    value={entryForm.productService}
                    onChange={(event) => handleEntryFormChange("productService", event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry-amount">
                    Valor
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-amount"
                    name="entry-amount"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={entryForm.amount}
                    onChange={(event) => handleEntryFormChange("amount", event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry-payment">
                    Forma de pagamento
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-payment"
                    name="entry-payment"
                    placeholder="Ex.: PIX, Dinheiro, Cartão"
                    value={entryForm.paymentMethod}
                    onChange={(event) => handleEntryFormChange("paymentMethod", event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry-notes">
                    Observações (opcional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-notes"
                    name="entry-notes"
                    placeholder="Referência, parcela, anexo..."
                    value={entryForm.notes}
                    onChange={(event) => handleEntryFormChange("notes", event.target.value)}
                  />
                </div>
              </div>

              {entryFormError ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{entryFormError}</p>
              ) : null}

              <div className="flex items-center justify-end">
                <button
                  className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCreatingEntry}
                  type="submit"
                >
                  {isCreatingEntry ? "Salvando..." : "Adicionar lançamento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {clientModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Cadastrar novo cliente</h3>
                <p className="text-sm text-slate-300/80">
                  Preencha as informações de contato e identificação fiscal.
                </p>
              </div>
              <button
                aria-label="Fechar modal"
                className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-sky-500 hover:text-sky-300"
                type="button"
                onClick={handleClientModalClose}
              >
                Fechar
              </button>
            </header>

            <form className="mt-6 space-y-5" onSubmit={handleCreateClient}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="client-name">
                  Nome do cliente
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                  id="client-name"
                  name="client-name"
                  value={clientForm.name}
                  onChange={(event) => handleClientFormChange("name", event.target.value)}
                  placeholder="Razão social ou nome fantasia"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="client-email">
                  E-mail
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                  id="client-email"
                  name="client-email"
                  type="email"
                  value={clientForm.email}
                  onChange={(event) => handleClientFormChange("email", event.target.value)}
                  placeholder="contato@cliente.com.br"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="client-cnpj">
                  CNPJ
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                  id="client-cnpj"
                  name="client-cnpj"
                  value={clientForm.cnpj}
                  onChange={(event) => handleClientFormChange("cnpj", event.target.value)}
                  placeholder="00.000.000/0000-00"
                  required
                />
              </div>

              {clientFormError ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {clientFormError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
                  type="button"
                  onClick={handleClientModalClose}
                >
                  Cancelar
                </button>
                <button
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCreatingClient}
                  type="submit"
                >
                  {isCreatingClient ? "Salvando..." : "Cadastrar cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
