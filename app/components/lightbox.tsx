import { useEffect, useRef } from "react";
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
      });

      lightboxRef.current.init();
    }

    return () => {
      if (lightboxRef.current) {
        lightboxRef.current.destroy();
        lightboxRef.current = null;
      }
    };
  }, [dataSource, setOpen]);

  useEffect(() => {
    if (open && lightboxRef.current) {
      lightboxRef.current.loadAndOpen(index && index > 0 ? index : 0);
    } else if (!open && lightboxRef.current) {
      lightboxRef.current?.pswp?.close();
    }
  }, [open, index]);

  return null;
};
