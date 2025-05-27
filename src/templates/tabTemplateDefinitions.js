// src/templates/tabTemplateDefinitions.js

export const TAB_TEMPLATE_DEFINITIONS = {
  company_intro: {
    type: 'company_intro',
    name: 'Company Introduction',
    description: 'Hero section with company benefits and contact information',
    blocks: [
      {
        type: 'hero',
        title: 'Why Choose {companyName}',
        subtitle: '{companyTagline}',
        icon: '🔧'
      },
      {
        type: 'benefit_cards',
        cards: [
          {
            icon: '🏆',
            title: 'Expert Craftsmanship',
            subtitle: 'Professional Excellence',
            description: 'Professional plumbing solutions with over {experienceYears} years of experience in residential and commercial projects.'
          },
          {
            icon: '⚡',
            title: 'Fast & Reliable',
            subtitle: 'Quick Response',
            description: 'Quick response times and efficient installations that minimize disruption to your daily routine.'
          },
          {
            icon: '🛡️',
            title: '{warrantyYears}-Year Warranty',
            subtitle: 'Complete Protection',
            description: 'Comprehensive warranty covering all materials and labor for complete peace of mind.'
          }
        ]
      },
      {
        type: 'contact_info',
        title: 'Contact Information',
        items: [
          { icon: '📞', label: 'Phone', value: '{phone}' },
          { icon: '✉️', label: 'Email', value: '{email}' },
          { icon: '📍', label: 'Address', value: '{address}' }
        ]
      }
    ]
  },

  quote_details: {
    type: 'quote_details',
    name: 'Quote Details',
    description: 'Quote breakdown with pricing and terms',
    blocks: [
      {
        type: 'quote_header',
        title: 'Quote #{quoteNumber}',
        subtitle: '{projectTitle}',
        customer_label: 'Prepared for: {customerName}'
      },
      {
        type: 'quote_breakdown',
        title: 'Pricing Breakdown',
        subtotal_label: 'Subtotal',
        tax_label: 'Tax',
        total_label: 'Total',
        quantity_label: 'Qty',
        section_total_label: 'Section Total'
      },
      {
        type: 'terms_section',
        title: 'Terms & Conditions',
        content: '{termsAndConditions}'
      }
    ]
  },

  process_steps: {
    type: 'process_steps',
    name: 'Our Process',
    description: 'Step-by-step process with timeline',
    blocks: [
      {
        type: 'hero',
        title: 'The {companyName} Process',
        subtitle: 'From consultation to completion, we guide you through every step',
        icon: '⚙️'
      },
      {
        type: 'process_steps',
        steps: [
          {
            step_number: 1,
            title: 'Initial Consultation',
            time: '1-2 days',
            description: 'Free in-home assessment and detailed quote preparation'
          },
          {
            step_number: 2,
            title: 'Project Planning',
            time: '3-5 days',
            description: 'Permit acquisition and material ordering'
          },
          {
            step_number: 3,
            title: 'Installation Begins',
            time: '1-3 days',
            description: 'Professional installation by certified technicians'
          },
          {
            step_number: 4,
            title: 'Quality Inspection',
            time: '1 day',
            description: 'Thorough testing and final walkthrough'
          },
          {
            step_number: 5,
            title: 'Project Complete',
            time: 'Same day',
            description: 'Final cleanup and warranty activation'
          }
        ]
      }
    ]
  },

  warranty_service: {
    type: 'warranty_service',
    name: 'Warranty & Service',
    description: 'Warranty information and service guarantees',
    blocks: [
      {
        type: 'hero',
        title: '{warrantyYears}-Year Peace of Mind',
        subtitle: 'Comprehensive protection for your investment',
        icon: '🛡️'
      },
      {
        type: 'warranty_cards',
        cards: [
          {
            icon: '🔧',
            title: 'Materials Warranty',
            subtitle: 'Manufacturer & Installation',
            description: 'All fixtures and materials covered against defects and installation issues'
          },
          {
            icon: '👨‍🔧',
            title: 'Labor Warranty',
            subtitle: 'Workmanship Guarantee',
            description: 'Professional installation work guaranteed for the full warranty period'
          },
          {
            icon: '🚨',
            title: 'Emergency Service',
            subtitle: '24/7 Support',
            description: 'Priority emergency service for warranty-covered issues'
          }
        ]
      },
      {
        type: 'service_list',
        title: 'What\'s Included in Your {warrantyYears}-Year Warranty',
        items: [
          '✅ All fixtures and fittings',
          '✅ Installation workmanship',
          '✅ Water damage protection',
          '✅ Free annual inspections',
          '✅ Priority scheduling for service calls',
          '✅ Transferable warranty (if home is sold)'
        ]
      }
    ]
  },

  system_details: {
    type: 'system_details',
    name: 'Project Details',
    description: 'Technical specifications and project scope',
    blocks: [
      {
        type: 'hero',
        title: 'Project Specifications',
        subtitle: 'Technical details and scope of work',
        icon: '📋'
      },
      {
        type: 'scope_list',
        title: 'Scope of Work',
        items: [
          '🔹 Kitchen sink and faucet replacement',
          '🔹 Master bathroom vanity installation',
          '🔹 Shower system upgrade with modern fixtures',
          '🔹 Water line routing and connections',
          '🔹 Drain line installation and testing',
          '🔹 Pressure testing and system certification'
        ]
      },
      {
        type: 'specifications',
        specs: [
          {
            title: 'Materials Used',
            items: [
              '• Premium PEX tubing',
              '• Brass fittings and valves',
              '• Code-compliant fixtures'
            ]
          },
          {
            title: 'Timeline',
            items: [
              '• Start: Within 1 week',
              '• Duration: 2-3 days',
              '• Completion: Full testing'
            ]
          }
        ]
      },
      {
        type: 'text_section',
        title: 'Permits & Compliance',
        content: 'All work will be performed to local building codes and permit requirements. We handle all permit applications and inspections to ensure your project meets all safety and regulatory standards.'
      }
    ]
  }
};

// Helper function to get template definition by type
export const getTabTemplate = (templateType) => {
  return TAB_TEMPLATE_DEFINITIONS[templateType] || null;
};

// Helper function to get all available template types
export const getAvailableTabTemplates = () => {
  return Object.keys(TAB_TEMPLATE_DEFINITIONS).map(key => ({
    type: key,
    name: TAB_TEMPLATE_DEFINITIONS[key].name,
    description: TAB_TEMPLATE_DEFINITIONS[key].description
  }));
};

// Helper function to replace variables in content
export const replaceTemplateVariables = (content, variables = {}) => {
  if (typeof content === 'string') {
    let result = content;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, value || `{${key}}`);
    });
    return result;
  }
  
  if (Array.isArray(content)) {
    return content.map(item => replaceTemplateVariables(item, variables));
  }
  
  if (typeof content === 'object' && content !== null) {
    const result = {};
    Object.entries(content).forEach(([key, value]) => {
      result[key] = replaceTemplateVariables(value, variables);
    });
    return result;
  }
  
  return content;
};