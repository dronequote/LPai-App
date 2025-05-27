// src/components/BlockRenderer.tsx
import React from 'react';
import { View, Text } from 'react-native';
import HeroBlock from './blocks/HeroBlock';
import BenefitCardsBlock from './blocks/BenefitCardsBlock';
import ContactInfoBlock from './blocks/ContactInfoBlock';
import ProcessStepsBlock from './blocks/ProcessStepsBlock';
import QuoteHeaderBlock from './blocks/QuoteHeaderBlock';
import QuoteBreakdownBlock from './blocks/QuoteBreakdownBlock';
import TermsSectionBlock from './blocks/TermsSectionBlock';
import { WarrantyCardsBlock } from './blocks/WarrantyCardsBlock'; // Named export
import { ServiceListBlock } from './blocks/ServiceListBlock'; // Named export
import ScopeListBlock from './blocks/ScopeListBlock';
import SpecificationsBlock from './blocks/SpecificationsBlock';
import TextSectionBlock from './blocks/TextSectionBlock';

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
  quote?: any; // Optional quote data for pricing blocks
}

export default function BlockRenderer({ block, styling, variables, quote }: BlockRendererProps) {
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
      
      case 'quote_header':
        return (
          <QuoteHeaderBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'quote_breakdown':
        return (
          <QuoteBreakdownBlock 
            content={block.content} 
            styling={styling} 
            variables={variables}
            quote={quote}
          />
        );
      
      case 'terms_section':
        return (
          <TermsSectionBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'warranty_cards':
        return (
          <WarrantyCardsBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'service_list':
        return (
          <ServiceListBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'scope_list':
        return (
          <ScopeListBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'specifications':
        return (
          <SpecificationsBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      case 'text_section':
        return (
          <TextSectionBlock 
            content={block.content} 
            styling={styling} 
            variables={variables} 
          />
        );
      
      default:
        return (
          <View style={{ padding: 20, backgroundColor: '#ffebee', borderRadius: 8, margin: 10 }}>
            <Text style={{ color: '#c62828', fontWeight: 'bold' }}>
              Unknown block type: {block.type}
            </Text>
          </View>
        );
    }
  };

  return <View key={block.id}>{renderBlock()}</View>;
}