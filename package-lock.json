import React, { createContext, useContext, useState } from "react";
import { Contract } from "../types";

const ContractContext = createContext<{
  currentContract: Contract;
  setCurrentContract: (c: Contract) => void;
} | undefined>(undefined);

export const ContractProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentContract, setCurrentContract] = useState<Contract>("TECA");
  return (
    <ContractContext.Provider value={{ currentContract, setCurrentContract }}>
      {children}
    </ContractContext.Provider>
  );
};

export const useContract = () => {
  const context = useContext(ContractContext);
  if (!context) throw new Error("useContract must be used within a ContractProvider");
  return context;
};
