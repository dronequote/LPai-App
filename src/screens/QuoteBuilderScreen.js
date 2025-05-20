import React from 'react';
import { View, Text, SafeAreaView, ScrollView, StyleSheet } from 'react-native';

const QuoteBuilderScreen = () => {
  // Placeholder: Pull part libraries per Location from DB

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Quote Builder</Text>
        {/* Placeholder: Form to add parts, calculate total, send quote */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default QuoteBuilderScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', margin: 16 },
});
