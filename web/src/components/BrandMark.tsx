import { useEffect } from "react";
import { apiUrl } from "../config";
import { useAuth } from "../auth";

export function useOrgFavicon() {
  const { org } = useAuth();
  const src = org?.logoSrc ? apiUrl(org.logoSrc) : null;

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!src) {
      if (link) link.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = src;
  }, [src]);
}

/** Top-left org mark (uploaded image, or the default gradient). */
export function BrandMark({ className = "" }: { className?: string }) {
  const { org } = useAuth();
  const src = org?.logoSrc ? apiUrl(org.logoSrc) : null;
  if (src) {
    return (
      <img
        className={`brand-mark brand-mark--img ${className}`.trim()}
        src={src}
        alt=""
        aria-hidden
      />
    );
  }
  return <span className={`brand-mark ${className}`.trim()} aria-hidden />;
}
