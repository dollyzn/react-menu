/**
 * Emoji a manager can pick for an ingredient, by section, each with the words
 * the search finds it by (pt-BR, without accents). Every emoji the API
 * suggests (`apps/api/app/kitchen/ingredient_icons.ts`) is here too.
 */
export type IconOption = { emoji: string; name: string; keywords?: string };

export const ICON_SECTIONS: { title: string; icons: IconOption[] }[] = [
  {
    title: "Massas e pães",
    icons: [
      { emoji: "🥟", name: "Massa de pastel", keywords: "massa pastel disco" },
      { emoji: "🍞", name: "Pão", keywords: "pao forma" },
      { emoji: "🥖", name: "Baguete", keywords: "pao frances baguete" },
      { emoji: "🥐", name: "Croissant", keywords: "folhada" },
      { emoji: "🫓", name: "Pão sírio", keywords: "tortilha rap10 sirio" },
      { emoji: "🍕", name: "Pizza", keywords: "massa pizza" },
      { emoji: "🍝", name: "Macarrão", keywords: "espaguete macarrao" },
      { emoji: "🍜", name: "Lámen", keywords: "miojo lamen" },
      { emoji: "🍚", name: "Arroz" },
      { emoji: "🌮", name: "Taco" },
      { emoji: "🌯", name: "Wrap", keywords: "burrito" },
      { emoji: "🥞", name: "Panqueca", keywords: "crepe" },
      { emoji: "🧇", name: "Waffle" },
    ],
  },
  {
    title: "Queijos e laticínios",
    icons: [
      { emoji: "🧀", name: "Queijo", keywords: "mussarela catupiry requeijao cheddar parmesao provolone coalho" },
      { emoji: "🥛", name: "Leite", keywords: "leite condensado creme de leite" },
      { emoji: "🧈", name: "Manteiga", keywords: "margarina" },
      { emoji: "🥚", name: "Ovo" },
      { emoji: "🍳", name: "Ovo frito", keywords: "omelete" },
      { emoji: "🍦", name: "Sorvete de casquinha", keywords: "sorvete" },
      { emoji: "🍨", name: "Sorvete", keywords: "acai creme" },
    ],
  },
  {
    title: "Carnes",
    icons: [
      { emoji: "🥩", name: "Carne", keywords: "carne moida seca picanha patinho" },
      { emoji: "🍖", name: "Carne com osso", keywords: "costela cupim presunto lombo peru" },
      { emoji: "🍗", name: "Frango", keywords: "galinha coxa" },
      { emoji: "🍔", name: "Hambúrguer", keywords: "hamburguer burger blend" },
      { emoji: "🌭", name: "Linguiça", keywords: "calabresa salsicha cachorro quente" },
      { emoji: "🥓", name: "Bacon" },
      { emoji: "🍤", name: "Camarão empanado", keywords: "camarao" },
      { emoji: "🦐", name: "Camarão", keywords: "camarao" },
      { emoji: "🐟", name: "Peixe", keywords: "atum salmao bacalhau tilapia" },
      { emoji: "🦑", name: "Lula" },
      { emoji: "🐙", name: "Polvo" },
      { emoji: "🦀", name: "Siri", keywords: "caranguejo" },
      { emoji: "🧆", name: "Bolinho", keywords: "falafel kibe almondega" },
    ],
  },
  {
    title: "Legumes e verduras",
    icons: [
      { emoji: "🍟", name: "Batata frita", keywords: "batata fritas" },
      { emoji: "🥔", name: "Batata", keywords: "mandioca aipim" },
      { emoji: "🍠", name: "Batata-doce", keywords: "batata doce" },
      { emoji: "🌽", name: "Milho" },
      { emoji: "🍅", name: "Tomate" },
      { emoji: "🫒", name: "Azeitona" },
      { emoji: "🥦", name: "Brócolis", keywords: "brocolis" },
      { emoji: "🥬", name: "Folhas", keywords: "alface escarola couve espinafre rucula repolho" },
      { emoji: "🥗", name: "Salada" },
      { emoji: "🌴", name: "Palmito" },
      { emoji: "🍆", name: "Berinjela", keywords: "beringela" },
      { emoji: "🧅", name: "Cebola" },
      { emoji: "🧄", name: "Alho" },
      { emoji: "🫑", name: "Pimentão", keywords: "pimentao" },
      { emoji: "🌶️", name: "Pimenta", keywords: "pimenta calabresa" },
      { emoji: "🥕", name: "Cenoura" },
      { emoji: "🥒", name: "Pepino", keywords: "picles" },
      { emoji: "🫛", name: "Ervilha", keywords: "vagem" },
      { emoji: "🫘", name: "Feijão", keywords: "feijao grao" },
      { emoji: "🍄", name: "Cogumelo", keywords: "champignon shimeji shitake" },
      { emoji: "🌿", name: "Ervas", keywords: "oregano manjericao salsinha cheiro verde cebolinha coentro" },
      { emoji: "🫚", name: "Gengibre" },
      { emoji: "🥑", name: "Abacate" },
    ],
  },
  {
    title: "Frutas",
    icons: [
      { emoji: "🍌", name: "Banana" },
      { emoji: "🍓", name: "Morango" },
      { emoji: "🥥", name: "Coco", keywords: "agua de coco" },
      { emoji: "🍍", name: "Abacaxi" },
      { emoji: "🍋", name: "Limão", keywords: "limao" },
      { emoji: "🍊", name: "Laranja", keywords: "tangerina" },
      { emoji: "🍎", name: "Maçã", keywords: "maca" },
      { emoji: "🍇", name: "Uva" },
      { emoji: "🍉", name: "Melancia" },
      { emoji: "🍈", name: "Maracujá", keywords: "maracuja melao" },
      { emoji: "🥭", name: "Manga" },
      { emoji: "🍑", name: "Pêssego", keywords: "pessego" },
      { emoji: "🍒", name: "Cereja" },
      { emoji: "🫐", name: "Açaí", keywords: "acai mirtilo" },
      { emoji: "🥜", name: "Amendoim", keywords: "pacoca" },
      { emoji: "🌰", name: "Castanha", keywords: "nozes" },
    ],
  },
  {
    title: "Doces",
    icons: [
      { emoji: "🍫", name: "Chocolate", keywords: "nutella brigadeiro cacau" },
      { emoji: "🤍", name: "Chocolate branco" },
      { emoji: "🍯", name: "Doce de leite", keywords: "mel" },
      { emoji: "🍬", name: "Doce", keywords: "goiabada acucar canela bala" },
      { emoji: "🍭", name: "Pirulito" },
      { emoji: "🍮", name: "Pudim", keywords: "flan" },
      { emoji: "🍰", name: "Bolo", keywords: "torta fatia" },
      { emoji: "🧁", name: "Cupcake", keywords: "bolinho" },
      { emoji: "🍪", name: "Biscoito", keywords: "bolacha cookie" },
      { emoji: "🍩", name: "Rosquinha", keywords: "donut sonho" },
      { emoji: "🍿", name: "Pipoca" },
    ],
  },
  {
    title: "Bebidas",
    icons: [
      { emoji: "🥤", name: "Refrigerante", keywords: "coca guarana lata copo" },
      { emoji: "🧃", name: "Suco", keywords: "nectar caixinha" },
      { emoji: "💧", name: "Água", keywords: "agua" },
      { emoji: "🧊", name: "Gelo" },
      { emoji: "☕", name: "Café", keywords: "cafe" },
      { emoji: "🍵", name: "Chá", keywords: "cha" },
      { emoji: "🧉", name: "Mate", keywords: "chimarrao terere" },
      { emoji: "🍺", name: "Cerveja", keywords: "chopp" },
      { emoji: "🍷", name: "Vinho" },
      { emoji: "🥃", name: "Destilado", keywords: "cachaca whisky" },
    ],
  },
  {
    title: "Temperos e outros",
    icons: [
      { emoji: "🧂", name: "Sal", keywords: "tempero" },
      { emoji: "🥫", name: "Molho", keywords: "ketchup mostarda maionese lata extrato" },
      { emoji: "🫙", name: "Pote", keywords: "oleo azeite conserva" },
      { emoji: "📦", name: "Embalagem", keywords: "caixa" },
      { emoji: "🥡", name: "Embalagem para viagem", keywords: "marmita viagem" },
      { emoji: "🛍️", name: "Sacola", keywords: "saco" },
      { emoji: "🧻", name: "Guardanapo", keywords: "papel" },
      { emoji: "🥄", name: "Talher", keywords: "colher garfo" },
      { emoji: "🔥", name: "Gás", keywords: "gas botijao" },
    ],
  },
];

export const ALL_ICONS: IconOption[] = ICON_SECTIONS.flatMap((section) => section.icons);

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Options whose name or words contain every word typed. */
export function searchIcons(query: string): IconOption[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return ALL_ICONS;
  return ALL_ICONS.filter((icon) => {
    const text = normalize(`${icon.name} ${icon.keywords ?? ""}`);
    return words.every((word) => text.includes(word));
  });
}

export const iconName = (emoji: string) => ALL_ICONS.find((icon) => icon.emoji === emoji)?.name ?? emoji;
