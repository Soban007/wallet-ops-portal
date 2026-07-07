"use client";

import { useEffect } from "react";

// Small helper so each route can set its own browser-tab title without
// turning every page into a server/client component split just for metadata.
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Wallet Ops`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
