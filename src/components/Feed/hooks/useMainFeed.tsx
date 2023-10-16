import { useFeedNextPage, useFeedPostIds } from '@src/state/feed/feedStore';
import {
  useDefaultCommunitySort,
  useDefaultListingType,
  useDefaultSort,
} from '@src/state/settings/settingsStore';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ListingType, SortType } from 'lemmy-js-client';
import { FlashList } from '@shopify/flash-list';
import { useScrollToTop } from '@react-navigation/native';
import IGetPostOptions from '@api/common/types/IGetPostOptions';
import { useLoadData } from '@src/hooks';
import instance from '@src/Instance';
import { cleanupPosts } from '@helpers/state';
import HStack from '@components/Common/Stack/HStack';
import ListingTypeContextMenuButton from '@components/Common/ContextMenu/components/buttons/ListingTypeContextMenuButton';
import SortTypeContextMenuButton from '@components/Common/ContextMenu/components/buttons/SortTypeContextMenuButton';
import { useNavigation, useRoute } from '@react-navigation/core';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HeaderBackButton } from '@react-navigation/elements';

interface UseMainFeed {
  postIds: number[];
  onEndReached: () => void;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  onRefresh: () => void;
  flashListRef: React.MutableRefObject<FlashList<number> | undefined>;
}

export const useMainFeed = (): UseMainFeed => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { key, params } = useRoute<any>();

  const postIds = useFeedPostIds(key);
  const nextPage = useFeedNextPage(key);

  const defaultSort = useDefaultSort();
  const defaultCommunitySort = useDefaultCommunitySort();
  const defaultListingType = useDefaultListingType();

  const [sortType, setSortType] = useState<SortType>(
    params?.name != null ? defaultCommunitySort ?? 'Hot' : defaultSort ?? 'Hot',
  );
  const [listingType, setListingType] = useState<ListingType>(
    defaultListingType ?? 'All',
  );

  const flashListRef = useRef<FlashList<number>>();

  // @ts-expect-error - This is valid but useScrollToTop expect a ref to a FlatList
  useScrollToTop(flashListRef);

  // Define the default options for the requests
  const defaultOptions = useMemo(
    (): IGetPostOptions => ({
      communityName: (params?.name as unknown as string) ?? undefined,
      sort: sortType,
      ...(params?.name == null && { type: listingType }),
    }),
    [params?.name, sortType, listingType],
  );

  // Create our data loader and get the initial content
  const { isLoading, isRefreshing, isError, append, refresh } = useLoadData(
    async () => {
      await instance.getPosts(
        key,
        {
          ...defaultOptions,
        },
        true,
      );
    },
  );

  // Add subs button if necessary and cleanup posts whenever we leave the screen
  useEffect(() => {
    navigation.setOptions({
      ...(params?.name == null && {
        headerLeft: () => (
          <HeaderBackButton
            label="Subscriptions"
            onPress={() => {
              navigation.navigate('Subscriptions');
            }}
            style={{ marginLeft: -16 }}
          />
        ),
      }),
    });

    return () => {
      cleanupPosts(key);
    };
  }, []);

  // Update the sort type when it changes
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HStack space="$4">
          <ListingTypeContextMenuButton
            listingType={listingType}
            setListingType={setListingType}
          />
          <SortTypeContextMenuButton
            sortType={sortType}
            setSortType={setSortType}
          />
        </HStack>
      ),
    });

    // See if we are already loading and if not, we will refresh
    if (!isLoading) {
      onRefresh();
      flashListRef.current?.scrollToOffset({ offset: 0 });
    }
  }, [sortType, listingType]);

  // Callback for loading more data when we hit the end
  const onEndReached = useCallback(() => {
    append(async () => {
      await instance.getPosts(key, {
        ...defaultOptions,
        page: nextPage,
      });
    });
  }, [defaultOptions, nextPage]);

  // Callback for refreshing the data
  const onRefresh = useCallback(() => {
    refresh(async () => {
      await instance.getPosts(key, {
        ...defaultOptions,
        page: 1,
        refresh: true,
      });
    });
  }, [defaultOptions]);

  return {
    postIds,
    onEndReached,
    isLoading,
    isRefreshing,
    onRefresh,
    isError,
    flashListRef,
  };
};