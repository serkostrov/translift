/** Карточки договора и заказчика: объекты списком и деньги одной суммой. */
import type { ObjectListItem } from './objects.js';
import type { ContractDto, CustomerDto } from './refs.js';

/**
 * Деньги по группе объектов — суммы полей «Финансов» всех объектов.
 * Видят администратор, руководитель и финансист; остальным приходит null.
 */
export type MoneySummary = {
  /** Сколько объектов с заполненными финансами из всех */
  withFinance: number;
  contractAmount: number;
  closedWorksAmount: number;
  paidAmount: number;
  /** Сумма остатков задолженности по объектам (формула — debtOf) */
  debt: number;
  /** Сумма для заказчиков с доп. соглашениями */
  totalAmount: number;
  /** Расходы по всем объектам */
  expenses: number;
  /** Сумма для заказчиков − расходы по объектам, где сумма указана */
  profit: number;
  /** Сколько объектов в минусе */
  negative: number;
};

export type ContractDetails = ContractDto & {
  /** Все объекты договора, включая архивные (у них archived: true) */
  objects: ObjectListItem[];
  money: MoneySummary | null;
};

export type CustomerListItem = CustomerDto & { contractsCount: number; objectsCount: number };

export type CustomerDetails = CustomerDto & {
  contracts: ContractDto[];
  objects: ObjectListItem[];
  money: MoneySummary | null;
};
