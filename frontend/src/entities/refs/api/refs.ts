/** Справочники: бригады, заказчики, договоры, шаблоны этапов, пользователи. */
import type {
  BrigadeDto,
  BrigadeUpsert,
  ContractDto,
  ContractUpsert,
  CustomerDto,
  CustomerUpsert,
  Role,
  StageTemplateDto,
  TemplateStageUpdate,
  UserCreate,
  UserDto,
  UserUpdate,
} from '@contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

/** Мутация с инвалидацией списка; id в аргументе — для PATCH. */
function useSave<TBody, TResult>(key: string, path: string, extraKeys: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: TBody }) =>
      http<TResult>(id ? `${path}/${id}` : path, { method: id ? 'PATCH' : 'POST', body }),
    onSuccess: () => {
      for (const k of [key, ...extraKeys]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const useBrigades = () =>
  useQuery({ queryKey: ['brigades'], queryFn: () => http<BrigadeDto[]>('/brigades') });
export const useSaveBrigade = () =>
  useSave<Partial<BrigadeUpsert>, BrigadeDto>('brigades', '/brigades', ['users', 'objects']);

export const useCustomers = () =>
  useQuery({ queryKey: ['customers'], queryFn: () => http<CustomerDto[]>('/customers') });
export const useSaveCustomer = () =>
  useSave<Partial<CustomerUpsert>, CustomerDto>('customers', '/customers', ['contracts']);

export const useContracts = () =>
  useQuery({ queryKey: ['contracts'], queryFn: () => http<ContractDto[]>('/contracts') });
export const useSaveContract = () =>
  useSave<Partial<ContractUpsert>, ContractDto>('contracts', '/contracts');

export const useTemplates = () =>
  useQuery({
    queryKey: ['templates'],
    queryFn: () => http<StageTemplateDto[]>('/templates'),
    staleTime: 5 * 60_000,
  });
export const useSaveTemplateStage = () =>
  useSave<TemplateStageUpdate, unknown>('templates', '/templates/stages', ['objects']);

export const useUsers = (role?: Role) =>
  useQuery({
    queryKey: ['users', role ?? 'all'],
    queryFn: () => http<UserDto[]>('/users', { query: { role } }),
  });
export const useSaveUser = () =>
  useSave<UserCreate | UserUpdate, UserDto>('users', '/users', ['brigades']);
