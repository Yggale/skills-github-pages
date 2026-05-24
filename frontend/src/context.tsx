// Shared selected-symbol context: lets Markets -> Trade share the current pair.

import React, { createContext, useContext, useState, ReactNode } from "react";

type SymbolCtx = {
  symbol: string;
  setSymbol: (s: string) => void;
};

const Ctx = createContext<SymbolCtx>({ symbol: "AUDUSD", setSymbol: () => {} });

export function SymbolProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState("AUDUSD");
  return <Ctx.Provider value={{ symbol, setSymbol }}>{children}</Ctx.Provider>;
}

export const useSymbol = () => useContext(Ctx);
