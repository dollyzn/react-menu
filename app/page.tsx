"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuHeader } from "@/components/menu-header";
import { Frown } from "lucide-react";

type MenuItem = {
  nome: string;
  descricao: string;
  preco: number;
};

type Category = {
  name: string;
  items: MenuItem[];
};

const cardapio: Category[] = [
  // Bebidas
  {
    name: "Bebidas",
    items: [
      { nome: "Refrigerante Coca-Cola", descricao: "Lata 350ml", preco: 5.0 },
      { nome: "Refrigerante Pepsi", descricao: "Lata 350ml", preco: 4.8 },
      { nome: "Refrigerante Guaraná", descricao: "Lata 350ml", preco: 4.5 },
      { nome: "Água Mineral", descricao: "Garrafa 500ml", preco: 3.0 },
      { nome: "Água com Gás", descricao: "Garrafa 500ml", preco: 3.5 },
      { nome: "Suco de Laranja", descricao: "Copo 300ml, natural", preco: 6.0 },
      { nome: "Suco de Morango", descricao: "Copo 300ml, natural", preco: 6.5 },
      {
        nome: "Chá Gelado",
        descricao: "Sabor limão ou pêssego, 300ml",
        preco: 5.0,
      },
      { nome: "Milkshake de Chocolate", descricao: "Copo 400ml", preco: 10.0 },
      { nome: "Milkshake de Morango", descricao: "Copo 400ml", preco: 10.0 },
    ],
  },
  // Pastéis Simples
  {
    name: "Pastéis Simples",
    items: [
      {
        nome: "Pastel de Carne",
        descricao: "Recheado com carne moída temperada",
        preco: 8.5,
      },
      {
        nome: "Pastel de Queijo",
        descricao: "Queijo derretido e cremoso",
        preco: 7.5,
      },
      { nome: "Pastel de Frango", descricao: "Frango desfiado", preco: 9.0 },
      {
        nome: "Pastel de Presunto e Queijo",
        descricao: "Presunto e queijo",
        preco: 9.0,
      },
      {
        nome: "Pastel de Palmito",
        descricao: "Recheio de palmito temperado",
        preco: 8.5,
      },
    ],
  },
  // Pastéis Selecionados
  {
    name: "Pastéis Selecionados",
    items: [
      {
        nome: "Pastel de Camarão",
        descricao: "Camarão com catupiry",
        preco: 12.0,
      },
      {
        nome: "Pastel de Bacalhau",
        descricao: "Recheado com bacalhau desfiado",
        preco: 13.0,
      },
      {
        nome: "Pastel de Alho Poró",
        descricao: "Alho-poró com queijo gruyère",
        preco: 11.0,
      },
    ],
  },
  // Pastéis Especiais
  {
    name: "Pastéis Especiais",
    items: [
      {
        nome: "Pastel de Carne Seca",
        descricao: "Carne seca com requeijão",
        preco: 10.0,
      },
      {
        nome: "Pastel de Strogonoff",
        descricao: "Strogonoff de carne ou frango",
        preco: 11.5,
      },
      {
        nome: "Pastel de Calabresa",
        descricao: "Calabresa com queijo",
        preco: 9.5,
      },
      {
        nome: "Pastel de Quatro Queijos",
        descricao: "Muçarela, parmesão, gorgonzola e catupiry",
        preco: 12.0,
      },
    ],
  },
  // Pastéis Doces
  {
    name: "Pastéis Doces",
    items: [
      {
        nome: "Pastel de Chocolate",
        descricao: "Chocolate derretido",
        preco: 10.0,
      },
      {
        nome: "Pastel de Banana",
        descricao: "Banana com canela e açúcar",
        preco: 9.0,
      },
      {
        nome: "Pastel de Doce de Leite",
        descricao: "Recheado com doce de leite",
        preco: 9.5,
      },
      {
        nome: "Pastel Romeu e Julieta",
        descricao: "Goiabada com queijo",
        preco: 10.0,
      },
    ],
  },
  // Adicionais
  {
    name: "Adicionais",
    items: [
      {
        nome: "Catupiry Extra",
        descricao: "Porção extra de catupiry",
        preco: 2.0,
      },
      { nome: "Queijo Extra", descricao: "Porção extra de queijo", preco: 2.0 },
      { nome: "Molho de Pimenta", descricao: "Porção de molho", preco: 1.0 },
      { nome: "Batata Frita", descricao: "Porção individual", preco: 5.0 },
      { nome: "Azeitonas", descricao: "Porção de azeitonas", preco: 2.5 },
    ],
  },
  // Sobremesas
  {
    name: "Sobremesas",
    items: [
      {
        nome: "Sorvete",
        descricao: "Bola de sorvete, diversos sabores",
        preco: 6.0,
      },
      {
        nome: "Petit Gateau",
        descricao: "Bolo de chocolate com sorvete",
        preco: 12.0,
      },
      {
        nome: "Brownie",
        descricao: "Brownie de chocolate com calda",
        preco: 8.0,
      },
      {
        nome: "Crepe Doce",
        descricao: "Recheado com chocolate e morango",
        preco: 10.0,
      },
    ],
  },
];

export default function Menu() {
  const [activeTab, setActiveTab] = useState<string>(cardapio[0].name);
  const [showTabs, setShowTabs] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>("");
  const [filteredMenu, setFilteredMenu] = useState<Category[]>(cardapio);
  const sectionsRef = useRef<(HTMLHeadingElement | null)[]>([]);
  const tabsListRef = useRef<HTMLDivElement | null>(null);

  const scrollToCategory = (categoryName: string) => {
    const element = document.getElementById(categoryName);

    if (element) {
      element.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "smooth",
      });
    }
  };

  const centerActiveTab = (tabValue: string) => {
    const tabsList = tabsListRef.current;
    if (!tabsList) return;

    const activeTabElement = tabsList.querySelector(
      `[data-value="${tabValue}"]`
    ) as HTMLElement;
    if (!activeTabElement) return;

    const tabWidth = activeTabElement.clientWidth;
    const tabOffsetLeft = activeTabElement.offsetLeft;
    const listWidth = tabsList.clientWidth;

    const scrollLeft = tabOffsetLeft - listWidth / 2 + tabWidth / 2;
    tabsList.scrollTo({ left: scrollLeft, behavior: "smooth" });
  };

  useEffect(() => {
    const observerOptions: IntersectionObserverInit = {
      rootMargin: "-135px 0px -100% 0px",
      threshold: 0,
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          console.log(entry.target.id, entry.isIntersecting);

          setActiveTab(entry.target.id);
          centerActiveTab(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(
      observerCallback,
      observerOptions
    );

    sectionsRef.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    const handleScroll = () => {
      setShowTabs(window.scrollY > 200); // Tabs aparecem após 200px de scroll
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (filter.trim() === "") {
      setFilteredMenu(cardapio);
    } else {
      const query = filter.toLowerCase();
      const filtered = cardapio
        .map((category) => ({
          ...category,
          items: category.items.filter(
            (item) =>
              item.nome.toLowerCase().includes(query) ||
              item.descricao.toLowerCase().includes(query)
          ),
        }))
        .filter((category) => category.items.length > 0);

      setFilteredMenu(filtered);
    }
  }, [filter]);

  return (
    <main className="min-h-screen pb-8 flex justify-center">
      <div className="w-full max-w-[500px] px-2">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            scrollToCategory(value);
          }}
          className={`sticky w-full z-10 top-[68px] bg-background transition-transform duration-300 ${
            showTabs ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <TabsList
            ref={tabsListRef}
            className="w-full overflow-hidden flex justify-start"
          >
            {cardapio.map((category) => (
              <TabsTrigger
                key={category.name}
                value={category.name}
                className="flex-shrink-0"
                data-value={category.name}
              >
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <MenuHeader filter={filter} setFilter={setFilter} />

        <div className="mt-4 space-y-8 px-2">
          {filteredMenu.length > 0 ? (
            filteredMenu.map((category, index) => (
              <div
                key={category.name}
                id={category.name}
                className="scroll-mt-32"
                ref={(el) => {
                  sectionsRef.current[index] = el;
                }}
              >
                <h2 className="text-2xl font-semibold mb-4">{category.name}</h2>
                <div className="space-y-4">
                  {category.items.map((item) => (
                    <Card key={item.nome} className="p-4">
                      <h3 className="text-lg font-semibold">{item.nome}</h3>
                      <p className="text-gray-600 text-sm">{item.descricao}</p>
                      <p className="text-green-600 font-bold mt-2">
                        R$ {item.preco.toFixed(2)}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center mt-10 text-center ">
              <Frown className="w-12 h-12 mb-4" />
              <p className="text-lg font-semibold">Nenhum produto encontrado</p>
              <p className="text-sm">Tente buscar por outro termo.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
