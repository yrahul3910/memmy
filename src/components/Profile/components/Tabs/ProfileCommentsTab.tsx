import React from 'react';
import VStack from '@components/Common/Stack/VStack';
import { useProfileScreenContext } from '@components/Profile/screens/ProfileScreen';
import { useProfileComments } from '@src/state/profile/profileStore';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { CommentView } from 'lemmy-js-client';
import Comment from '@components/Comment/components/Comment';
import FeedLoadingIndicator from '@components/Feed/components/Feed/FeedLoadingIndicator';

const renderItem = ({
  item,
}: ListRenderItemInfo<CommentView>): React.JSX.Element => {
  return <Comment itemId={item.comment.id} />;
};

const keyExtractor = (item: CommentView): string => item.comment.id.toString();

export default function ProfileCommentsTab(): React.JSX.Element {
  const profileScreenContext = useProfileScreenContext();
  const profileComments = useProfileComments(profileScreenContext.profileId);

  return (
    <VStack flex={1}>
      <FlashList<CommentView>
        renderItem={renderItem}
        data={profileComments}
        keyExtractor={keyExtractor}
        estimatedItemSize={100}
        ListEmptyComponent={
          <FeedLoadingIndicator
            loading={profileScreenContext.isLoading}
            error={profileScreenContext.isError}
          />
        }
        // ref={flashListRef}
      />
    </VStack>
  );
}
