// src/components/BlockRenderer.tsx
import React from 'react';
import { View } from 'react-native';
import HeroBlock from './blocks/HeroBlock';
import BenefitCardsBlock from './blocks/BenefitCardsBlock';
import ContactInfoBlock from './blocks/ContactInfoBlock';
import ProcessStepsBlock from './blocks/ProcessStepsBlock';
// Import other blocks as we create them

interface Block {
  id: string;
  type: string;
  position: number;
  content: any;
}

interface BlockRendererProps {
  block: Block;
  styling: {
    primaryColor: string;
    accentColor: string;
  };
  variables: Record<string, string>;
}

export default function BlockRenderer({ block, styling, variables }: BlockRendererProps) {
  const renderBlock = () => {
    switch (block.type) {
      case 'hero':
        return (
          <HeroBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'benefit_cards':
        return (
          <BenefitCardsBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'contact_info':
        return (
          <ContactInfoBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'process_steps':
        return (
          <ProcessStepsBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      // Add other cases as we create more blocks
      case 'quote_header':
      case 'quote_breakdown':
      case 'terms_section':
      case 'warranty_cards':
      case 'service_list':
      case 'scope_list':
      case 'specifications':
      case 'text_section':
        // TODO: Implement these blocks
        return <View><Text>Block type "{block.type}" not implemented yet</Text></View>;
      
      default:
        return <View><Text>Unknown block type: {block.type}</Text></View>;
    }
  };

  return <View key={block.id}>{renderBlock()}</View>;
}