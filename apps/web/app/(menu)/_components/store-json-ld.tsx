import type { PublicMenu } from "@react-menu/contracts";
import { env } from "@/lib/env";
import { menuPath } from "../_lib/store-seo";

/**
 * schema.org Restaurant with its whole menu (sections, items, prices in
 * BRL, availability): what search engines read for rich results. Server
 * rendered; "<" is escaped so store text can't close the script.
 */
export function StoreJsonLd({ menu }: { menu: PublicMenu }) {
  const { store } = menu;
  const url = new URL(menuPath(store), env.NEXT_PUBLIC_APP_URL).toString();
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${url}#restaurant`,
    name: store.name,
    url,
    description: store.description ?? undefined,
    image: [store.bannerUrl, store.photoUrl].filter(Boolean),
    logo: store.photoUrl ?? undefined,
    telephone: store.phone ?? undefined,
    address: store.address
      ? { "@type": "PostalAddress", streetAddress: store.address, addressCountry: "BR" }
      : undefined,
    sameAs: [store.instagramUrl, store.ifoodUrl].filter(Boolean),
    acceptsReservations: false,
    currenciesAccepted: "BRL",
    paymentAccepted: store.paymentMethods
      .map((method) => ({ pix: "Pix", card: "Cartão de crédito", counter: "Dinheiro, cartão ou Pix no balcão" })[method])
      .join(", "),
    potentialAction: {
      "@type": "OrderAction",
      target: { "@type": "EntryPoint", urlTemplate: url, inLanguage: "pt-BR" },
      deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModePickUp",
    },
    hasMenu: {
      "@type": "Menu",
      name: `Cardápio ${store.name}`,
      inLanguage: "pt-BR",
      hasMenuSection: menu.categories.map((category) => ({
        "@type": "MenuSection",
        name: category.name,
        description: category.description ?? undefined,
        hasMenuItem: category.items.map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          description: item.description ?? undefined,
          image: item.photoUrl ?? undefined,
          offers: {
            "@type": "Offer",
            price: item.price.toFixed(2),
            priceCurrency: "BRL",
            availability: item.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        })),
      })),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
