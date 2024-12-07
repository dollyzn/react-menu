"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuHeader } from "./components/menu-header";
import { Frown, ShoppingCart } from "lucide-react";
import NextImage from "next/image";
import cardapio from "./data/categories.json";
import { Lightbox } from "./components/lightbox";

type MenuItem = {
  nome: string;
  descricao: string;
  preco: number;
  foto: string;
};

type Category = {
  name: string;
  itens: MenuItem[];
};

interface Photo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

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
          items: category.itens.filter(
            (item) =>
              item.nome.toLowerCase().includes(query) ||
              item.descricao.toLowerCase().includes(query)
          ),
        }))
        .filter((category) => category.items.length > 0);

      setFilteredMenu(filtered);
    }
  }, [filter]);

  const [photos, setPhotos] = useState<Photo[]>();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  async function loadImageDimensions(
    url: string
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const image = new Image();
      image.src = url;
      image.onload = () => {
        resolve({ width: image.width, height: image.height });
      };
    });
  }

  async function handlePhotoClick(index: number, element: HTMLElement) {
    const photos = await Promise.all(
      cardapio.flatMap((category) =>
        category.itens.map(async ({ foto, nome }) => {
          const { width, height } = await loadImageDimensions(foto);
          return {
            src: foto,
            alt: nome,
            width: width,
            height: height,
            element,
            msrc: foto,
          };
        })
      )
    );

    setGalleryOpen(true);
    setGalleryIndex(index);
    setPhotos(photos);
  }

  let globalIndex = 0;

  const refs = useRef<HTMLDivElement[]>([]);

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
                  {category.itens.map((item) => {
                    const currentGlobalIndex = globalIndex;
                    globalIndex += 1;

                    return (
                      <Card key={item.nome} className="p-3 flex gap-4">
                        <div
                          className="w-24 h-24 flex-shrink-0"
                          ref={(el) => {
                            if (el) refs.current[currentGlobalIndex] = el;
                          }}
                          onClick={() =>
                            handlePhotoClick(
                              currentGlobalIndex,
                              refs.current[currentGlobalIndex]
                            )
                          }
                        >
                          <NextImage
                            src={item.foto}
                            width={96}
                            height={96}
                            alt="Batata frita"
                            className="w-full h-full object-cover rounded-md"
                          />
                        </div>
                        <div className="flex flex-col justify-between flex-grow gap-2">
                          <div className="space-y-1">
                            <h3 className="font-semibold">{item.nome}</h3>
                            <p className="text-sm text-muted-foreground">
                              {item.descricao}
                            </p>
                          </div>
                          <p className="text-sm font-semibold">
                            R$ {item.preco.toFixed(2)}
                          </p>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          ) : cardapio.length > 0 ? (
            <div className="flex flex-col items-center justify-center mt-10 text-center">
              <Frown className="w-12 h-12 mb-4" />
              <p className="text-lg font-semibold">Nenhum produto encontrado</p>
              <p className="text-sm">Tente buscar por outro termo.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center mt-10 text-center">
              <ShoppingCart className="w-10 h-10 mb-4" />
              <p className="text-xl font-semibold mb-2">
                Nenhum produto disponível
              </p>
              <p className="text-sm text-muted-foreground">
                No momento, nosso cardápio está sem produtos. <br />
                Tente novamente mais tarde.
              </p>
            </div>
          )}
        </div>
      </div>

      <Lightbox
        images={photos}
        open={galleryOpen}
        index={galleryIndex}
        setOpen={setGalleryOpen}
      />
    </main>
  );
}
