// src/components/blocks/ProcessStepsBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProcessStepsBlockProps {
  content: {
    steps: Array<{
      stepNumber: number;
      title: string;
      time: string;
      description: string;
    }>;
  };
  styling: {
    primaryColor: string;
    accentColor: string;
  };
  variables: Record<string, string>;
}

const replaceVariables = (text: string, variables: Record<string, string>): string => {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, value || `{${key}}`);
  });
  return result;
};

export default function ProcessStepsBlock({ content, styling, variables }: ProcessStepsBlockProps) {
  return (
    <View style={styles.processSteps}>
      {content.steps.map((step, index) => {
        const title = replaceVariables(step.title, variables);
        const description = replaceVariables(step.description, variables);
        
        return (
          <View key={index} style={styles.processStep}>
            <View style={[styles.processStepNumber, { backgroundColor: styling.primaryColor }]}>
              <Text style={styles.processStepNumberText}>{step.stepNumber}</Text>
            </View>
            <View style={styles.processStepContent}>
              <View style={styles.processStepHeader}>
                <Text style={styles.processStepTitle}>{title}</Text>
                <Text style={[styles.processStepTime, { color: styling.accentColor }]}>{step.time}</Text>
              </View>
              <Text style={styles.processStepDescription}>{description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  processSteps: {
    gap: 20,
  },
  processStep: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  processStepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  processStepNumberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  processStepContent: {
    flex: 1,
  },
  processStepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  processStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  processStepTime: {
    fontSize: 14,
    fontWeight: '500',
  },
  processStepDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});