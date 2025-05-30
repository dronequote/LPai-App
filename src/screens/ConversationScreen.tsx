import React from 'react';
import { View, Text, SafeAreaView, ScrollView, StyleSheet } from 'react-native';

const ConversationsScreen = () => {
  // Placeholder: Fetch SMS/email/call threads from DB

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Conversations</Text>
        {/* Placeholder: Conversation threads */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ConversationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', margin: 16 },
});
