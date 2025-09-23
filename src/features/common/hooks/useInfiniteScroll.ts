"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";

interface UseInfiniteScrollProps {
  fetchData: (
    page: number,
    limit: number
  ) => Promise<{
    data: KanbanBoardTask[];
    total: number;
    hasMore: boolean;
  }>;
  initialData?: KanbanBoardTask[];
  visibleItems: number;
  stackSize: number;
  filterKey?: string; // Add a key to detect filter changes
}

interface UseInfiniteScrollReturn {
  visibleTasks: KanbanBoardTask[];
  isLoading: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function useInfiniteScroll({
  fetchData,
  initialData = [],
  visibleItems = 10,
  stackSize = 30,
  filterKey,
}: UseInfiniteScrollProps): UseInfiniteScrollReturn {
  const [allTasks, setAllTasks] = useState<KanbanBoardTask[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [startIndex, setStartIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchDataRef = useRef(fetchData);
  const isInitialLoad = useRef(true);

  // Keep fetchDataRef up to date
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Calculate visible tasks from the stack
  const visibleTasks = allTasks.slice(startIndex, startIndex + visibleItems);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchDataRef.current(currentPage, visibleItems); // Fetch based on visible items

      if (result.data.length === 0) {
        setHasMore(false);
        return;
      }

      setAllTasks((prev) => {
        const newTasks = [...prev, ...result.data];

        // If we exceed stack size, remove from the beginning
        if (newTasks.length > stackSize) {
          const removedCount = newTasks.length - stackSize;
          const newStartIndex = Math.max(0, startIndex - removedCount);
          setStartIndex(newStartIndex);
          return newTasks.slice(removedCount);
        }

        return newTasks;
      });

      setCurrentPage((prev) => prev + 1);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, isLoading, hasMore, stackSize, startIndex, visibleItems]); // Add visibleItems to dependencies

  // Handle scroll to load more data
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isLoading || !hasMore) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 10; // Load more when 10px from bottom
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    if (distanceFromBottom <= threshold) {
      loadMore();
    }
  }, [loadMore, isLoading, hasMore, allTasks.length, visibleTasks.length]);

  // Handle scroll to load previous data when scrolling up
  const handleScrollUp = useCallback(() => {
    if (!scrollRef.current || isLoading || startIndex === 0) return;

    const { scrollTop } = scrollRef.current;
    const threshold = 200; // Load previous when 200px from top

    if (scrollTop <= threshold) {
      const newStartIndex = Math.max(0, startIndex - 10);
      setStartIndex(newStartIndex);
    }
  }, [startIndex, isLoading]);

  // Combined scroll handler
  const onScroll = useCallback(() => {
    handleScroll();
    handleScrollUp();
  }, [handleScroll, handleScrollUp]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    scrollElement.addEventListener("scroll", onScroll);
    return () => scrollElement.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  // Reset state when filters change
  useEffect(() => {
    setAllTasks([]);
    setCurrentPage(1);
    setStartIndex(0);
    setHasMore(true);
    setError(null);
    setIsLoading(false);
    isInitialLoad.current = true;
  }, [filterKey]);

  // Load initial data when filterKey changes or on mount
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      const loadInitialData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const result = await fetchDataRef.current(1, visibleItems);
          if (result.data.length === 0) {
            setHasMore(false);
          } else {
            setAllTasks(result.data);
            setCurrentPage(2);
            setHasMore(result.hasMore);
          }
        } catch (err) {
          setError(err as Error);
        } finally {
          setIsLoading(false);
        }
      };
      loadInitialData();
    }
  }, [filterKey]);

  return {
    visibleTasks,
    isLoading,
    hasMore,
    error,
    loadMore,
    scrollRef,
  };
}
