import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function GroupDetailTestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
      <Text>Group details</Text>
      <Text>Group ID: {id}</Text>
    </View>
  );
}