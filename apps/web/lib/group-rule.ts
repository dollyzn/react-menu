/** Rule of a choice group in words: "Obrigatório · escolha 1", "Opcional · até 2". */
export function groupRule(group: { minChoices: number; maxChoices: number; allowRepeat?: boolean }) {
  const repeat = group.allowRepeat ? " · pode repetir" : "";
  if (group.minChoices === 0) return `Opcional · até ${group.maxChoices}${repeat}`;
  if (group.minChoices === group.maxChoices) return `Obrigatório · escolha ${group.minChoices}${repeat}`;
  return `Obrigatório · de ${group.minChoices} a ${group.maxChoices}${repeat}`;
}
