import React, { useEffect, useRef, useState } from 'react';

interface UseLoadData<DataType = undefined> {
  refresh: (refreshFunc?: () => Promise<DataType>) => void;
  append: (appendFunc: () => Promise<DataType>) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  error?: string;
  data?: DataType;
}

interface Status {
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  error?: string;
}

export const useLoadData = <ReturnType>(
  func: () => Promise<ReturnType>,
  cacheFunc?: () => boolean,
  setPage?: React.Dispatch<React.SetStateAction<number>>,
): UseLoadData<ReturnType> => {
  const inProgress = useRef(false);

  const [status, setStatus] = useState<Status>({
    isLoading: true,
    isRefreshing: false,
    isError: false,
    error: undefined,
  });

  const [returnData, setReturnData] = useState<ReturnType>();

  useEffect(() => {
    if (cacheFunc != null) {
      const res = cacheFunc();

      if (res) {
        setStatus({
          ...status,
          isLoading: false,
          isError: false,
          error: undefined,
        });

        return;
      }
    }

    run(func);
  }, []);

  const run = (
    func: () => Promise<ReturnType>,
    append = false,
    refresh = false,
  ): void => {
    if (inProgress.current) return;

    inProgress.current = true;

    setStatus({
      ...status,
      isLoading: true,
      isError: false,
      isRefreshing: refresh,
      error: undefined,
    });

    void func()
      .then((data) => {
        if (append) {
          console.log('Appending.');
          console.log(returnData);

          if (returnData != null && data != null) {
            console.log('Was iterable');

            // @ts-expect-error We already checked that data is iterable
            setReturnData((prev) => [...(prev ?? []), ...data]);
          }

          setPage?.((prev) => prev + 1);
        } else {
          setStatus((prev) => ({
            ...prev,
            isLoading: false,
            isError: false,
            isRefreshing: false,
            error: undefined,
          }));

          setReturnData(data);

          setPage?.(2);
        }

        inProgress.current = false;
      })
      .catch((e) => {
        setStatus((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          isRefreshing: false,
          error: e.message,
        }));

        inProgress.current = false;

        console.log(e);
      });
  };

  const refresh = (refreshFunc?: () => Promise<ReturnType>): void => {
    if (refreshFunc == null) refreshFunc = func;

    run(refreshFunc, false, true);
  };

  const append = (appendFunc: () => Promise<ReturnType>): void => {
    run(appendFunc, true);
  };

  return {
    ...status,
    refresh,
    append,
    data: returnData,
  };
};
