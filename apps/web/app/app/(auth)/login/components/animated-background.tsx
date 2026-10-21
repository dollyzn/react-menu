import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import { Heart } from "lucide-react";

/**
 * Screens of the app itself, in light and dark. Regenerate them with
 * e2e/marquee-screenshots.spec.ts after visible UI changes.
 */
const SCREENS = [
  "menu", "orders", "kitchen", "item", "pos", "overview",
  "tracking", "inventory", "items", "members", "categories",
];
const images = [
  ...SCREENS.map((name, index) => `/login-marquee/${name}-${index % 2 ? "dark" : "light"}.webp`),
  ...SCREENS.map((name, index) => `/login-marquee/${name}-${index % 2 ? "light" : "dark"}.webp`),
];

export default function AnimatedBackground() {
  return (
    <div className="relative hidden h-full flex-col bg-muted p-6 lg:flex border-r">
      <div className="absolute inset-0 -top-30 bg-primary overflow-hidden">
        <ThreeDMarquee images={images} className="h-auto" />
      </div>
      <div className="relative z-20 flex justify-end items-center text-lg font-medium text-primary-foreground">
        Menu App
      </div>
      <div className="relative z-20 mt-auto text-primary-foreground text-sm flex items-center gap-1">
        Feito com <Heart className="size-4 fill-primary-foreground" /> por{" "}
        <a
          href="https://github.com/dollyzn"
          target="_blank"
          className="underline"
        >
          dollyzn
        </a>
      </div>
    </div>
  );
}
