import React, { useCallback, useMemo } from 'react';
import { CommunityView } from 'lemmy-js-client';
import VStack from '@components/Common/Stack/VStack';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { Globe, Star, StarOff } from '@tamagui/lucide-icons';
import HStack from '@components/Common/Stack/HStack';
import { Text, View } from 'tamagui';
import { getBaseUrl } from '@helpers/links';
import {
  addOrUpdateFavorite,
  setDrawerOpen,
  useAccountFavorites,
  useCurrentAccount,
} from '@src/state';
import { NavigationContainerRefWithCurrent } from '@react-navigation/core';
import { createName } from '@helpers/text';

interface IProps {
  view: CommunityView;
  navigation: NavigationContainerRefWithCurrent<ReactNavigation.RootParamList>;
}

function DrawerItem({ view, navigation }: IProps): React.JSX.Element {
  // const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const currentAccount = useCurrentAccount();
  const favorites = useAccountFavorites(currentAccount!.fullUsername);

  const instance = useMemo(() => getBaseUrl(view.community.actor_id), [view]);

  const favorited = useMemo(
    () => favorites?.includes(view.community.id),
    [favorites],
  );

  const onCommunityPress = useCallback(() => {
    setDrawerOpen(false);
    navigation.navigate('Community', {
      name: createName(view.community.name, view.community.actor_id, true),
      id: view.community.id,
    });
  }, [view]);

  const onFavoritePress = useCallback(() => {
    addOrUpdateFavorite(currentAccount!.fullUsername, view.community.id);
  }, [currentAccount, view]);

  return (
    <HStack
      space="$2"
      onPress={onCommunityPress}
      alignItems="center"
      paddingHorizontal="$3"
      paddingVertical="$2"
      backgroundColor="$fg"
    >
      {view.community.icon != null ? (
        <Image source={view.community.icon} style={styles.image} />
      ) : (
        <Globe color="$accent" />
      )}
      <VStack>
        <Text fontSize="$3">{view.community.name}</Text>
        <Text fontSize="$2" color="$secondary">
          {instance}
        </Text>
      </VStack>
      <View marginLeft="auto" onPress={onFavoritePress}>
        {favorited === true ? (
          <Star color="$accent" />
        ) : (
          <StarOff color="$accent" />
        )}
      </View>
    </HStack>
  );
}

const styles = StyleSheet.create({
  image: {
    height: 30,
    width: 30,
    borderRadius: 100,
  },
});

export default React.memo(DrawerItem);