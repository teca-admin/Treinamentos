export type Role = "Admin" | "RH" | "SST" | "Escala" | "Treinamento" | "Gestor";
export type Contract = "TECA" | "RAMPA" | "CANAL DE INSPEÇÃO";

export interface User {
  id: number;
  username: string;
  role: Role;
  name: string;
}

export interface Funcionario {
  id: number;
  nome: string;
  cpf: string;
  rg?: string;
  data_nascimento?: string;
  matricula: string;
  data_admissao: string;
  cargo: string;
  contrato: string;
  status: string;
}
