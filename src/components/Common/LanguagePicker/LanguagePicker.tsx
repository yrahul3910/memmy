import React from 'react';
import { Picker } from '@react-native-picker/picker';
import { LayoutAnimation } from 'react-native';
import { useSiteLanguages } from '@src/state/site/siteStore';
import { View } from 'tamagui';

interface IProps {
  selected: number;
  setSelected: React.Dispatch<React.SetStateAction<number>>;
}

function LanguagePicker({
  selected,
  setSelected,
}: IProps): React.JSX.Element | null {
  const languages = useSiteLanguages();

  if (languages == null) return null;

  return (
    <View flex={1}>
      <Picker
        onLayout={() => LayoutAnimation.easeInEaseOut}
        onValueChange={setSelected}
        selectedValue={selected}
      >
        {languages.map((option, index) => (
          <Picker.Item
            key={index}
            label={option.name}
            value={option.id}
            enabled
          />
        ))}
      </Picker>
    </View>
  );
}

export default React.memo(LanguagePicker);
