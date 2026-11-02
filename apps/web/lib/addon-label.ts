/**
 * How an add-on reads on a bag line, ticket or order: "Recheio extra: Carne"
 * for a choice group pick, just the name otherwise (the API's kitchen and
 * e-mails use the same format).
 */
export const addonLabel = (addon: { name: string; groupName?: string | null }) =>
  addon.groupName ? `${addon.groupName}: ${addon.name}` : addon.name;
