import {
  type InfiniteData,
  keepPreviousData,
  type QueryKey,
  useInfiniteQuery,
} from '@tanstack/react-query';
import type { Paging } from '@/shared/ui/infinite-footer';

/** Ответ постраничного API: записи, всего и откуда грузить дальше. */
export type PageLike<T> = { items: T[]; total: number; nextOffset: number | null };

/**
 * Бесконечная прокрутка: первая порция, дальше — по offset, который вернул сервер.
 * При смене фильтров старый список остаётся на экране, пока не придёт новый.
 */
export function useInfinitePages<T, P extends PageLike<T> = PageLike<T>>(
  queryKey: QueryKey,
  fetchPage: (offset: number) => Promise<P>,
  options: { refetchInterval?: number; enabled?: boolean } = {},
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    ...options,
  });
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const paging: Paging = {
    hasMore: !!query.hasNextPage,
    loading: query.isFetchingNextPage,
    onMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    shown: items.length,
    total: pages.at(-1)?.total ?? 0,
  };
  return { query, items, paging, first: pages[0] as P | undefined };
}

export type { InfiniteData };
