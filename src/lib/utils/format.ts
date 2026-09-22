// Utilitários de formatação no padrão brasileiro (pt-BR).
// Valores monetários trafegam em centavos (inteiros) e só viram string aqui.

export function formatCurrencyBRL(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDateBR(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTimeBR(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// Data de hoje no fuso horário LOCAL do dispositivo, no formato YYYY-MM-DD.
// Nunca usar `new Date().toISOString().slice(0, 10)` para isso: toISOString
// converte para UTC, então entre ~21h e 23h59 no horário de Brasília (UTC-3)
// o UTC já virou o dia seguinte e o campo de data viria preenchido com
// amanhã em vez de hoje — fazendo a conta "sumir" dos filtros de período
// (Hoje/Semana/Mês), que comparam com a data local.
export function todayLocalIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Mesma ideia de `todayLocalIso`, mas para "daqui a N dias" (aceita negativo
// para "N dias atrás"), sempre no fuso horário local.
export function localIsoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function reaisToCents(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Math.round(parseFloat(normalized || "0") * 100);
}
