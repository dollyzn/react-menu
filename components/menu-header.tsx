import {
  ArrowLeft,
  CircleUserRound,
  MapPin,
  Search,
  Star,
  User,
  UserRound,
} from "lucide-react";
import { ModeSwitcher } from "@/components/mode-switcher";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import banner from "../public/banner.jpg";
import logo from "../public/logo.png";
import Image from "next/image";
import { redirectToLogin } from "@/utils/navigation";
import { useRouter } from "next/navigation";

interface MenuHeaderProps {
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
}
export function MenuHeader({ filter, setFilter }: MenuHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex flex-col w-full pt-8">
      {/* Search bar */}
      <div className="py-4 z-50 flex items-center gap-2 fixed top-0 left-1/2 -translate-x-1/2 bg-background w-full min-[502px]:w-[500px] px-2">
        {filter && (
          <Button variant="outline" size="icon" onClick={() => setFilter("")}>
            <ArrowLeft />
          </Button>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
          <Input
            type="text"
            placeholder="Buscar produtos"
            className="pl-10"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <ModeSwitcher />
        <Button
          size="icon"
          variant="outline"
          onClick={() => redirectToLogin(router)}
        >
          <User />
        </Button>
      </div>

      {!filter && (
        <>
          {" "}
          {/* Menu banner */}
          <div className="relative h-48 w-full ">
            <Image
              priority
              src={banner}
              alt="Restaurant banner"
              className="w-full h-full object-cover rounded-t-xl"
            />
          </div>
          {/* Info */}
          <Card className="-mt-4 relative bg-zinc-50 dark:bg-black dark:text-white p-4 border-none">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 overflow-hidden">
                <Image
                  src={logo}
                  alt="Restaurant logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold">JJ Pastéis</h1>
                <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
                  <span className="bg-green-600 text-white px-2 py-0.5 rounded-full text-xs">
                    Aberto
                  </span>
                  <div className="flex gap-1 items-center">
                    <Star
                      size={16}
                      className="fill-yellow-500 text-yellow-500"
                    />
                    <Star
                      size={16}
                      className="fill-yellow-500 text-yellow-500"
                    />
                    <Star
                      size={16}
                      className="fill-yellow-500 text-yellow-500"
                    />
                    <Star
                      size={16}
                      className="fill-yellow-500 text-yellow-500"
                    />
                    <Star
                      size={16}
                      className="fill-yellow-500 text-yellow-500"
                    />
                  </div>
                </div>
                <div className="flex gap-1 items-center text-sm mt-1 text-zinc-400">
                  <MapPin size={16} /> Praia do Boqueirão - Santos / SP
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </header>
  );
}
