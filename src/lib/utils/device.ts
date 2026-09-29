// Foco automático em campos só faz sentido com mouse/teclado. No celular, focar
// um campo ao abrir um modal abre o teclado na hora e cobre parte do formulário.
export function shouldAutoFocus(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }

  return window.matchMedia("(pointer: fine)").matches;
}
