import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import { PhotoSwipeOptions, SlideData } from "photoswipe";

interface LightboxProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  index?: number;
  dataSource?: SlideData | SlideData[];
}

export const Lightbox = ({
  dataSource,
  open,
  index,
  setOpen,
}: LightboxProps) => {
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!dataSource && window.location.hash === "#pswp") {
      router.replace(window.location.pathname, { scroll: false });
    }
  }, [dataSource, router]);

  useEffect(() => {
    if (!dataSource) return;

    const images = Array.isArray(dataSource) ? dataSource : [dataSource];

    if (images && images.length > 0) {
      const options: Partial<PhotoSwipeOptions> = {
        dataSource: images,
        bgOpacity: 0.95,
        indexIndicatorSep: " de ",
        closeTitle: "Fechar",
        zoomTitle: "Zoom",
        arrowPrevTitle: "Anterior",
        arrowNextTitle: "Próximo",
        errorMsg: "A imagem não foi carregada corretamente",
        initialZoomLevel: "fit",
        secondaryZoomLevel: 1.3,
        wheelToZoom: true,
        showHideAnimationType: "zoom",
        pswpModule: () => import("photoswipe"),
      };

      lightboxRef.current = new PhotoSwipeLightbox(options);
      lightboxRef.current.on("close", () => {
        setOpen(false);
        if (window.location.hash === "#pswp") {
          router.back();
        }
      });

      lightboxRef.current.init();
    }

    return () => {
      if (lightboxRef.current) {
        lightboxRef.current.destroy();
        lightboxRef.current = null;
      }
    };
  }, [dataSource, setOpen, router]);

  useEffect(() => {
    const handlePopState = () => {
      const isHashPswp = window.location.hash === "#pswp";

      if (!lightboxRef.current) return;

      if (isHashPswp && !open) {
        setOpen(true);
        lightboxRef.current.loadAndOpen(index && index > 0 ? index : 0);
      } else if (!isHashPswp && open && lightboxRef.current.pswp) {
        setOpen(false);
        lightboxRef.current.pswp.close();
      }
    };

    if (open && lightboxRef.current) {
      lightboxRef.current.loadAndOpen(index && index > 0 ? index : 0);
      router.push("#pswp", { scroll: false });
    } else if (!open && lightboxRef.current) {
      lightboxRef.current?.pswp?.close();
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [open, setOpen, index, router]);

  return null;
};
