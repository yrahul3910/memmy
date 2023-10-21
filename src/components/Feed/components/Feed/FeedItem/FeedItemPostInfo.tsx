import React from 'react';
import PostUserLabel from '@components/Common/PostCard/PostUserLabel';
import { usePostCreator } from '@src/state';
import PostMetrics from '@components/Common/PostCard/PostMetrics';
import { YStack } from 'tamagui';

interface IProps {
  itemId: number;
}

export default function FeedItemPostInfo({
  itemId,
}: IProps): React.JSX.Element {
  const postUser = usePostCreator(itemId);

  return (
    <YStack space="$2">
      <PostUserLabel
        userName={postUser?.name}
        userCommunity={postUser?.actor_id}
        userIcon={postUser?.avatar}
      />
      <PostMetrics itemId={itemId} />
    </YStack>
  );
}
