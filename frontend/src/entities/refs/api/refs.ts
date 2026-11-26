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
  UserWithPassword,
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

/** Удалить совсем: только записи без истории, иначе сервер ответит 409 с причиной. */
function useRemove(key: string, path: string, extraKeys: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http<void>(`${path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      for (const k of [key, ...extraKeys]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const useDeleteBrigade = () => useRemove('brigades', '/brigades', ['users']);
export const useDeleteUser = () => useRemove('users', '/users', ['brigades']);

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
/** Новый сотрудник; в ответе — временный пароль, его показываем один раз. */
export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserCreate) => http<UserWithPassword>('/users', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};
export const useUpdateUser = () => useSave<UserUpdate, UserDto>('users', '/users', ['brigades']);

/** Сброс пароля: система придумывает временный, сотрудник выходит на всех устройствах. */
/** Отклонить запрос «Забыли пароль?» без выдачи нового пароля. */
export const useDismissResetRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http<void>(`/users/${id}/reset-request`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useResetPassword = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http<UserWithPassword>(`/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};
