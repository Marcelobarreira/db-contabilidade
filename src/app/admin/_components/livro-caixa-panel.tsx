'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import type { MovementCategory } from "@prisma/client";

type Company = {
  id: number;
  name: string;
  email: string;
  cnpj: string;
};

type Client = Company;

type CashEntry = {
  id: number;
  companyId: number;
  date: string;
  counterpart: string;
  productService: string;
  movement: MovementOption;
  type: ActivityOption;
  amount: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  paymentMethod: PaymentOption;
};

type LivroCaixaPanelProps = {
  initialClients: Client[];
  canCreateClients?: boolean;
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
type PaymentOption =
  | "PIX"
  | "DINHEIRO"
  | "BOLETO"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "CHEQUE"
  | "OUTROS";

type ImportPreview = {
  filename: string;
  format: "csv" | "ofx";
  currency?: string;
  transactions: Array<{
    date: string;
    amount: number;
    description: string;
    reference: string;
    counterpart: string;
    productService: string;
    paymentMethod: PaymentOption;
    movement: MovementCategory;
  }>;
};

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

const PAYMENT_OPTIONS: { value: PaymentOption; label: string }[] = [
  { value: "PIX", label: "PIX" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO_CREDITO", label: "Cartão de crédito" },
  { value: "CARTAO_DEBITO", label: "Cartão de débito" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OUTROS", label: "Outros" },
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

export default function LivroCaixaPanel({ initialClients, canCreateClients = false }: LivroCaixaPanelProps) {
  const [clients, setClients] = useState<Client[]>(
    initialClients.map((client) => ({
      ...client,
      cnpj: client.cnpj.replace(/\D/g, ""),
    })),
  );
  const [selectedClientId, setSelectedClientId] = useState<number | "">(() => {
    if (!canCreateClients && initialClients.length === 1) {
      return initialClients[0].id;
    }
    return "";
  });

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
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);
  const [isEditing, startEditTransition] = useTransition();
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [isImporting, startImportTransition] = useTransition();
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

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
          setEntriesError("Não foi possível carregar os lançamentos dessa empresa.");
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

  useEffect(() => {
    setSelectedEntryIds([]);
  }, [selectedClientId]);

  useEffect(() => {
    setSelectedEntryIds((prev) => {
      const valid = prev.filter((id) => entries.some((entry) => entry.id === id));
      return valid.length === prev.length ? prev : valid;
    });
  }, [entries]);

  useEffect(() => {
    if (canCreateClients) {
      return;
    }
    if (clients.length === 1) {
      const singleClientId = clients[0].id;
      setSelectedClientId((prev) => (prev === singleClientId ? prev : singleClientId));
    }
  }, [canCreateClients, clients]);

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

  const selectedEntryIdsSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);
  const selectedEntriesCount = selectedEntryIds.length;
  const allVisibleSelected =
    enhancedEntries.length > 0 && enhancedEntries.every((entry) => selectedEntryIdsSet.has(entry.id));

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = selectedEntriesCount > 0 && !allVisibleSelected;
    }
  }, [selectedEntriesCount, allVisibleSelected]);

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

  function applyCurrencyMask(rawValue: string) {
    const digits = rawValue.replace(/\D/g, "");
    const number = Number(digits) / 100;
    return currencyFormatter
      .format(number)
      .replace(/\s/g, "")
      .replace("R$", "")
      .trim();
  }

  function handleEntryFormChange<K extends keyof EntryFormState>(field: K, value: string) {
    setEntryForm((prev) => ({
      ...prev,
      [field]:
        field === "amount"
          ? applyCurrencyMask(normalizeAmountInput(value))
          : value,
    }));
  }

  function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateClients) {
      setClientFormError("Voce nao tem permissao para criar empresas.");
      return;
    }
    const payload = {
      name: clientForm.name.trim(),
      email: clientForm.email.trim(),
      cnpj: clientForm.cnpj.trim(),
    };

    if (!payload.name || !payload.email || !payload.cnpj) {
      setClientFormError("Preencha todos os campos para cadastrar a empresa.");
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
          setClientFormError(body.error ?? "Não foi possível cadastrar a empresa.");
          return;
        }

        const createdClient: Client = await response.json();
        setClients((prev) => [...prev, { ...createdClient, cnpj: createdClient.cnpj.replace(/\D/g, "") }]);
        setSelectedClientId(createdClient.id);
        handleClientModalClose();
      } catch (error) {
        console.error("Erro ao cadastrar empresa", error);
        setClientFormError("Não foi possível cadastrar a empresa. Tente novamente.");
      }
    });
  }

  function handleCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (typeof selectedClientId !== "number") {
      setEntryFormError("Selecione uma empresa antes de adicionar o lançamento.");
      return;
    }

    const payload = {
      ...entryForm,
      amount: entryForm.amount,
      paymentMethod: entryForm.paymentMethod,
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

  function handleEditEntry(entry: CashEntry) {
    setEditingEntry(entry);
    setEditError(null);
  }

  function handleCloseEditModal() {
    setEditingEntry(null);
    setEditError(null);
  }

  function handleUpdateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEntry) {
      return;
    }

    const payload = {
      id: editingEntry.id,
      companyId: editingEntry.companyId,
      date: editingEntry.date.slice(0, 10),
      movement: editingEntry.movement,
      counterpart: editingEntry.counterpart,
      productService: editingEntry.productService,
      type: editingEntry.type,
      paymentMethod: editingEntry.paymentMethod,
      amount: currencyFormatter
        .format(editingEntry.amount)
        .replace(/\s/g, "")
        .replace("R$", "")
        .trim(),
      notes: editingEntry.notes ?? "",
    };

    const payloadBody = {
      ...payload,
      amount: payload.amount,
    };

    startEditTransition(async () => {
      try {
        const response = await fetch(
          `/api/clients/${editingEntry.companyId}/cash-entries/${editingEntry.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payloadBody),
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Erro inesperado ao atualizar." }));
          setEditError(body.error ?? "Não foi possível atualizar o lançamento.");
          return;
        }

        const updated = (await response.json()) as CashEntry;
        setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
        handleCloseEditModal();
      } catch (error) {
        console.error("Erro ao atualizar lançamento", error);
        setEditError("Não foi possível atualizar o lançamento. Tente novamente.");
      }
    });
  }

  function handleDeleteEntry(entry: CashEntry) {
    if (!window.confirm("Tem certeza que deseja excluir este lançamento?")) {
      return;
    }

    startDeleteTransition(async () => {
      try {
        const response = await fetch(
          `/api/clients/${entry.companyId}/cash-entries/${entry.id}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Erro inesperado ao excluir." }));
          alert(body.error ?? "Não foi possível excluir o lançamento.");
          return;
        }

        setEntries((prev) => prev.filter((existing) => existing.id !== entry.id));
        if (editingEntry?.id === entry.id) {
          handleCloseEditModal();
        }
      } catch (error) {
        console.error("Erro ao excluir lançamento", error);
        alert("Não foi possível excluir o lançamento. Tente novamente.");
      }
    });
  }

  function handleToggleEntrySelection(entryId: number) {
    setSelectedEntryIds((prev) => {
      if (prev.includes(entryId)) {
        return prev.filter((id) => id !== entryId);
      }
      return [...prev, entryId];
    });
  }

  function handleToggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedEntryIds((prev) => prev.filter((id) => !enhancedEntries.some((entry) => entry.id === id)));
    } else {
      setSelectedEntryIds((prev) => {
        const next = new Set(prev);
        enhancedEntries.forEach((entry) => next.add(entry.id));
        return Array.from(next);
      });
    }
  }

  async function handleBulkDelete() {
    if (!selectedEntriesCount || typeof selectedClientId !== "number") {
      return;
    }

    if (
      !window.confirm(
        selectedEntriesCount === 1
          ? "Excluir o lançamento selecionado?"
          : `Excluir ${selectedEntriesCount} lançamentos selecionados?`,
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    try {
      for (const entryId of selectedEntryIds) {
        const response = await fetch(`/api/clients/${selectedClientId}/cash-entries/${entryId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Erro inesperado ao excluir." }));
          throw new Error(body.error ?? "Não foi possível excluir um dos lançamentos selecionados.");
        }
      }

      setEntries((prev) => prev.filter((entry) => !selectedEntryIdsSet.has(entry.id)));
      setSelectedEntryIds([]);
    } catch (error) {
      console.error("Erro ao excluir lançamentos em massa", error);
      alert("Não foi possível excluir todos os lançamentos selecionados. Tente novamente.");
    } finally {
      setBulkDeleting(false);
    }
  }

  const hasClients = formattedClients.length > 0;
  const importTransactionsCount = importPreview?.transactions.length ?? 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-white/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Livro-caixa</h2>
          <p className="text-sm text-slate-300/80">
            {canCreateClients
              ? "Selecione uma empresa para gerenciar lançamentos ou cadastre uma nova."
              : "Selecione a empresa autorizada para gerenciar os lançamentos."}
          </p>
        </div>
        {canCreateClients ? (
          <button
            className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            type="button"
            onClick={() => setClientModalOpen(true)}
          >
            Nova empresa
          </button>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-200" htmlFor="client">
          Empresa
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
              {canCreateClients ? <option value="">Selecione uma empresa</option> : null}
              {formattedClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.formattedCnpj}
                </option>
              ))}
            </>
          ) : (
            <option value="">Nenhuma empresa cadastrada</option>
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
            {canCreateClients
              ? "Escolha uma empresa ou cadastre uma nova para acessar o livro-caixa."
              : "Escolha uma empresa para acessar o livro-caixa."}
          </p>
        )}
      </div>

      {selectedClient ? (
        <div className="mt-10 space-y-10">
          <section className="space-y-6">
            <header className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Lançamentos</h3>
              <p className="text-sm text-slate-300/80">
                O livro-caixa é a ferramenta de controle financeiro da empresa. Acompanhe os lançamentos e filtre por data.
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
              <div className="max-h-[28rem] overflow-y-auto overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          ref={selectAllCheckboxRef}
                          aria-label="Selecionar todas as movimentacoes visiveis"
                          className="h-4 w-4 rounded border border-white/30 bg-slate-950/80 text-sky-500 focus:ring-2 focus:ring-sky-500 disabled:opacity-40"
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={handleToggleSelectAll}
                          disabled={isFetchingEntries || entriesError != null || bulkDeleting}
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Empresa / Fornecedor</th>
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
                        <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={10}>
                          Carregando lançamentos...
                        </td>
                      </tr>
                    ) : entriesError ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-red-300" colSpan={10}>
                          {entriesError}
                        </td>
                      </tr>
                    ) : enhancedEntries.length > 0 ? (
                      enhancedEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-900/60">
                          <td className="px-4 py-3">
                            <input
                              aria-label="Selecionar movimentação"
                              className="h-4 w-4 rounded border border-white/30 bg-slate-950/80 text-sky-500 focus:ring-2 focus:ring-sky-500 disabled:opacity-40"
                              type="checkbox"
                              checked={selectedEntryIdsSet.has(entry.id)}
                              onChange={() => handleToggleEntrySelection(entry.id)}
                              disabled={bulkDeleting}
                            />
                          </td>
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
                          <td className="px-4 py-3">{formatPayment(entry.paymentMethod)}</td>
                          <td className="px-4 py-3 font-semibold">
                            {currencyFormatter.format(entry.runningBalance)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-xs">
                              <button
                                className="rounded-lg border border-white/10 px-3 py-1 font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
                                type="button"
                                onClick={() => handleEditEntry(entry)}
                                disabled={bulkDeleting}
                              >
                                Editar
                              </button>
                              <button
                                className="rounded-lg border border-red-500/40 px-3 py-1 font-semibold text-red-200 transition hover:bg-red-500/10 disabled:opacity-40"
                                type="button"
                                onClick={() => handleDeleteEntry(entry)}
                                disabled={isDeleting || bulkDeleting}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={10}>
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
              <div className="flex flex-col items-start gap-3 text-base font-semibold sm:items-end">
                <span>
                  Saldo:&nbsp;
                  <span className={totalBalance >= 0 ? "text-sky-300" : "text-red-300"}>
                    {currencyFormatter.format(totalBalance)}
                  </span>
                </span>
                <button
                  className="inline-flex items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedEntriesCount === 0 || bulkDeleting}
                >
                  {bulkDeleting
                    ? "Excluindo lancamentos..."
                    : selectedEntriesCount > 0
                      ? `Excluir ${selectedEntriesCount} selecionado${selectedEntriesCount > 1 ? "s" : ""}`
                      : "Excluir selecionados"}
                </button>
              </div>
            </aside>
          </section>

          <section className="space-y-6 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <header className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Adicionar lançamento</p>
              <h3 className="text-xl font-semibold text-white">Registrar movimentação financeira</h3>
              <p className="text-sm text-slate-300/80">
                Preencha os campos abaixo para adicionar um novo lançamento ao livro-caixa da empresa selecionada.
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
                    Empresa ou fornecedor
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-counterpart"
                    name="entry-counterpart"
                  placeholder="Nome da empresa ou fornecedor"
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
                  <select
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="entry-payment"
                    name="entry-payment"
                    value={entryForm.paymentMethod}
                    onChange={(event) => handleEntryFormChange("paymentMethod", event.target.value)}
                    required
                  >
                    {PAYMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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

              {!importPreview && importError ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{importError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-500 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={typeof selectedClientId !== "number"}
                >
                  Importar extrato
                </button>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept=".csv,.ofx,application/ofx,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (typeof selectedClientId !== "number") {
                      setImportError("Selecione uma empresa antes de importar.");
                      return;
                    }
                    setImportError(null);
                    startImportTransition(async () => {
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const response = await fetch("/api/importar-extrato", {
                          method: "POST",
                          body: formData,
                        });
                        if (!response.ok) {
                          const body = await response.json().catch(() => ({ error: "Falha ao importar o extrato." }));
                          setImportError(body.error ?? "Não foi possível importar o extrato.");
                          return;
                        }
                        const data = (await response.json()) as ImportPreview;
                        setImportPreview(data);
                        setImportError(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      } catch (error) {
                        console.error("Erro ao importar extrato", error);
                        setImportError("Não foi possível importar o extrato. Tente novamente.");
                      }
                    });
                  }}
                />
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

      {canCreateClients && clientModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Cadastrar nova empresa</h3>
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
                  Nome da empresa
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
                  placeholder="contato@empresa.com.br"
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
                  {isCreatingClient ? "Salvando..." : "Cadastrar empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Editar lançamento</h3>
                <p className="text-sm text-slate-300/80">Atualize as informações ou exclua o lançamento definitivamente.</p>
              </div>
              <button
                aria-label="Fechar modal"
                className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-sky-500 hover:text-sky-300"
                type="button"
                onClick={handleCloseEditModal}
              >
                Fechar
              </button>
            </header>

            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                handleUpdateEntry(event);
              }}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-sm font-medium text-slate-200" htmlFor="edit-date">
                    Data
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="edit-date"
                    type="date"
                    value={editingEntry.date.slice(0, 10)}
                    onChange={(event) =>
                      setEditingEntry((prev) =>
                        prev ? { ...prev, date: `${event.target.value}T00:00:00.000Z` } : prev,
                      )
                    }
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-1">
                  <label className="text-sm font-medium text-slate-200" htmlFor="edit-movement">
                    Movimentação
                  </label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="edit-movement"
                    value={editingEntry.movement}
                    onChange={(event) =>
                      setEditingEntry((prev) => (prev ? { ...prev, movement: event.target.value as MovementOption } : prev))
                    }
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
                  <label className="text-sm font-medium text-slate-200" htmlFor="edit-type">
                    Tipo
                  </label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="edit-type"
                    value={editingEntry.type}
                    onChange={(event) =>
                      setEditingEntry((prev) => (prev ? { ...prev, type: event.target.value as ActivityOption } : prev))
                    }
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
                  <label className="text-sm font-medium text-slate-200" htmlFor="edit-counterpart">
                    Empresa ou fornecedor
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="edit-counterpart"
                    value={editingEntry.counterpart}
                    onChange={(event) =>
                      setEditingEntry((prev) => (prev ? { ...prev, counterpart: event.target.value } : prev))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="edit-product">
                    Produto / serviço
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="edit-product"
                    value={editingEntry.productService}
                    onChange={(event) =>
                      setEditingEntry((prev) => (prev ? { ...prev, productService: event.target.value } : prev))
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="edit-amount">
                    Valor
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="edit-amount"
                    inputMode="decimal"
                    value={applyCurrencyMask(editingEntry.amount.toString())}
                    onChange={(event) =>
                      setEditingEntry((prev) =>
                        prev
                          ? {
                              ...prev,
                              amount:
                                Number(normalizeAmountInput(event.target.value)) / 100,
                            }
                          : prev,
                      )
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="edit-payment">
                    Forma de pagamento
                  </label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="edit-payment"
                    value={editingEntry.paymentMethod}
                    onChange={(event) =>
                      setEditingEntry((prev) =>
                        prev ? { ...prev, paymentMethod: event.target.value as PaymentOption } : prev,
                      )
                    }
                    required
                  >
                    {PAYMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="edit-notes">
                    Observações (opcional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                    id="edit-notes"
                    value={editingEntry.notes ?? ""}
                    onChange={(event) =>
                      setEditingEntry((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                    }
                  />
                </div>
              </div>

              {editError ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{editError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
                  type="button"
                  onClick={handleCloseEditModal}
                >
                  Cancelar
                </button>
                <button
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
                  type="button"
                  onClick={() => handleDeleteEntry(editingEntry)}
                  disabled={isDeleting}
                >
                  Excluir
                </button>
                <button
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isEditing}
                  type="submit"
                >
                  {isEditing ? "Salvando..." : "Atualizar lançamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {importPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur">
          <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Pre-visualizacao do extrato</h3>
                <p className="text-sm text-slate-300/80">
                  {importPreview.filename} · {importPreview.format.toUpperCase()} · {importPreview.currency ?? "BRL"} ·{" "}
                  {importTransactionsCount} lancamentos
                </p>
              </div>
              <button
                className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
                type="button"
                onClick={() => {
                  setImportPreview(null);
                  setImportError(null);
                }}
              >
                Fechar
              </button>
            </header>

            {importError ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {importError}
              </p>
            ) : null}

            <div className="mt-6 max-h-96 overflow-auto rounded-2xl border border-white/10 bg-slate-950/60">
              <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
                <thead className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Empresa / Fornecedor</th>
                    <th className="px-4 py-3 text-left">Produto / Servico</th>
                    <th className="px-4 py-3 text-left">Movimentacao</th>
                    <th className="px-4 py-3 text-left">Forma pagamento</th>
                    <th className="px-4 py-3 text-left">Valor</th>
                    <th className="px-4 py-3 text-left">Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {importPreview.transactions.map((item, index) => (
                    <tr key={`${item.reference}-${index}`} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3">{item.date || "—"}</td>
                      <td className="px-4 py-3">{item.counterpart}</td>
                      <td className="px-4 py-3">
                        <p>{item.productService}</p>
                        <p className="text-xs text-slate-400">{item.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        {item.movement === "DESPESA" || item.movement === "COMPRA" || item.movement === "RETIRADA"
                          ? "Saida"
                          : "Entrada"}
                      </td>
                      <td className="px-4 py-3">{formatPayment(item.paymentMethod)}</td>
                      <td className="px-4 py-3 font-semibold">{currencyFormatter.format(item.amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{item.reference || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
                type="button"
                onClick={() => {
                  setImportPreview(null);
                  setImportError(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isImporting || typeof selectedClientId !== "number" || importTransactionsCount === 0}
                onClick={async () => {
                  if (!importPreview || typeof selectedClientId !== "number") {
                    return;
                  }
                  setImportError(null);
                  startImportTransition(async () => {
                    try {
                      const newEntries: CashEntry[] = [];
                      for (const transaction of importPreview.transactions) {
                        if (!transaction.date) {
                          continue;
                        }

                        const movementValue: MovementOption =
                          transaction.movement === "DESPESA"
                            ? "DESPESA"
                            : transaction.movement === "COMPRA"
                              ? "COMPRA"
                              : transaction.movement === "RETIRADA"
                                ? "RETIRADA"
                                : "RECEITA";

                        const payload = {
                          date: transaction.date,
                          movement: movementValue,
                          counterpart: transaction.counterpart || "Nao identificado",
                          productService: transaction.productService || "Nao identificado (NI)",
                          type: "SERVICO",
                          paymentMethod: transaction.paymentMethod,
                          amount: transaction.amount.toFixed(2),
                          notes: transaction.reference || undefined,
                        };

                        const response = await fetch(
                          `/api/clients/${selectedClientId}/cash-entries`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(payload),
                          },
                        );

                        if (!response.ok) {
                          const body = await response.json().catch(() => ({ error: "Falha ao salvar lançamento." }));
                          throw new Error(body.error ?? "Falha ao salvar lançamento.");
                        }

                        const created = (await response.json()) as CashEntry;
                        newEntries.push(created);
                      }

                      if (newEntries.length > 0) {
                        setEntries((prev) => [...prev, ...newEntries]);
                      }
                      setImportPreview(null);
                    } catch (error) {
                      console.error("Erro ao confirmar importacao", error);
                      setImportError("Nao foi possivel importar todos os lancamentos. Tente novamente.");
                    }
                  });
                }}
              >
                {isImporting ? "Importando..." : "Adicionar lancamentos"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatPayment(label: PaymentOption) {
  return (
    PAYMENT_OPTIONS.find((option) => option.value === label)?.label ??
    label
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}
