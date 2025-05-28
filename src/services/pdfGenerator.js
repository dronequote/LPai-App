// src/services/pdfGenerator.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export class QuotePDFGenerator {
  constructor() {
    this.pageWidth = 595; // A4 width in points
    this.pageHeight = 842; // A4 height in points
    this.margin = 50;
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  async generateSignedQuotePDF(quote, template, companyData, signatures) {
    try {
      console.log('[PDF Generator] Starting PDF generation for quote:', quote.quoteNumber);
      
      // Create new PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([this.pageWidth, this.pageHeight]);
      
      // Load fonts
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let currentY = this.pageHeight - this.margin;
      
      // Header with company info
      currentY = await this.addHeader(page, companyData, template, helveticaBoldFont, helveticaFont, currentY);
      
      // Quote information
      currentY = await this.addQuoteInfo(page, quote, helveticaBoldFont, helveticaFont, currentY);
      
      // Customer information
      currentY = await this.addCustomerInfo(page, quote, helveticaBoldFont, helveticaFont, currentY);
      
      // Quote sections and pricing
      currentY = await this.addQuoteSections(page, quote, helveticaBoldFont, helveticaFont, currentY);
      
      // Terms and conditions
      currentY = await this.addTermsAndConditions(page, companyData, template, helveticaFont, currentY);
      
      // Signature section
      currentY = await this.addSignatureSection(page, signatures, helveticaBoldFont, helveticaFont, currentY);
      
      // Embed signatures if they exist
      if (signatures.consultant || signatures.customer) {
        await this.embedSignatures(pdfDoc, page, signatures, currentY);
      }
      
      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();
      
      console.log('[PDF Generator] PDF generated successfully, size:', pdfBytes.length);
      return pdfBytes;
      
    } catch (error) {
      console.error('[PDF Generator] Error generating PDF:', error);
      throw new Error('Failed to generate PDF: ' + error.message);
    }
  }

  async addHeader(page, companyData, template, boldFont, regularFont, startY) {
    const companyName = template?.companyOverrides?.name || companyData.name || 'Your Company';
    const primaryColor = this.hexToRgb(template?.styling?.primaryColor || '#2E86AB');
    
    // Company name
    page.drawText(companyName, {
      x: this.margin,
      y: startY,
      size: 24,
      font: boldFont,
      color: primaryColor,
    });
    
    startY -= 30;
    
    // Company contact info
    const contactInfo = [
      template?.companyOverrides?.phone || companyData.phone,
      template?.companyOverrides?.email || companyData.email,
      template?.companyOverrides?.address || companyData.address,
    ].filter(Boolean);
    
    contactInfo.forEach(info => {
      if (info) {
        page.drawText(info, {
          x: this.margin,
          y: startY,
          size: 10,
          font: regularFont,
          color: rgb(0.4, 0.4, 0.4),
        });
        startY -= 15;
      }
    });
    
    // Horizontal line
    page.drawLine({
      start: { x: this.margin, y: startY - 10 },
      end: { x: this.pageWidth - this.margin, y: startY - 10 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    
    return startY - 30;
  }

  async addQuoteInfo(page, quote, boldFont, regularFont, startY) {
    // Quote title
    page.drawText('QUOTE', {
      x: this.margin,
      y: startY,
      size: 20,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    // Quote number (right aligned)
    const quoteNumberText = `Quote #${quote.quoteNumber}`;
    const quoteNumberWidth = boldFont.widthOfTextAtSize(quoteNumberText, 14);
    page.drawText(quoteNumberText, {
      x: this.pageWidth - this.margin - quoteNumberWidth,
      y: startY,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    startY -= 40;
    
    // Project title
    page.drawText(quote.projectTitle || quote.title, {
      x: this.margin,
      y: startY,
      size: 16,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    // Date (right aligned)
    const dateText = `Date: ${new Date().toLocaleDateString()}`;
    const dateWidth = regularFont.widthOfTextAtSize(dateText, 10);
    page.drawText(dateText, {
      x: this.pageWidth - this.margin - dateWidth,
      y: startY,
      size: 10,
      font: regularFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    return startY - 30;
  }

  async addCustomerInfo(page, quote, boldFont, regularFont, startY) {
    page.drawText('Prepared for:', {
      x: this.margin,
      y: startY,
      size: 12,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    startY -= 20;
    
    page.drawText(quote.customerName || 'Customer', {
      x: this.margin,
      y: startY,
      size: 12,
      font: regularFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    return startY - 30;
  }

  async addQuoteSections(page, quote, boldFont, regularFont, startY) {
    const sections = quote.sections || [];
    
    sections.forEach(section => {
      // Section header
      page.drawText(section.name || 'Section', {
        x: this.margin,
        y: startY,
        size: 14,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      
      startY -= 25;
      
      // Line items
      (section.lineItems || []).forEach(item => {
        const itemText = `${item.name} - Qty: ${item.quantity} @ $${item.unitPrice}`;
        page.drawText(itemText, {
          x: this.margin + 20,
          y: startY,
          size: 10,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        // Item total (right aligned)
        const totalText = `$${item.totalPrice.toLocaleString()}`;
        const totalWidth = regularFont.widthOfTextAtSize(totalText, 10);
        page.drawText(totalText, {
          x: this.pageWidth - this.margin - totalWidth,
          y: startY,
          size: 10,
          font: regularFont,
          color: rgb(0.1, 0.1, 0.1),
        });
        
        startY -= 15;
      });
      
      // Section total
      const sectionTotalText = `Section Total: $${(section.subtotal || 0).toLocaleString()}`;
      const sectionTotalWidth = boldFont.widthOfTextAtSize(sectionTotalText, 11);
      page.drawText(sectionTotalText, {
        x: this.pageWidth - this.margin - sectionTotalWidth,
        y: startY,
        size: 11,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      
      startY -= 30;
    });
    
    // Totals section
    const subtotal = quote.subtotal || 0;
    const taxAmount = quote.taxAmount || 0;
    const total = quote.total || 0;
    
    // Subtotal
    const subtotalText = `Subtotal: $${subtotal.toLocaleString()}`;
    const subtotalWidth = regularFont.widthOfTextAtSize(subtotalText, 12);
    page.drawText(subtotalText, {
      x: this.pageWidth - this.margin - subtotalWidth,
      y: startY,
      size: 12,
      font: regularFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    startY -= 20;
    
    // Tax
    const taxText = `Tax: $${taxAmount.toLocaleString()}`;
    const taxWidth = regularFont.widthOfTextAtSize(taxText, 12);
    page.drawText(taxText, {
      x: this.pageWidth - this.margin - taxWidth,
      y: startY,
      size: 12,
      font: regularFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    startY -= 30;
    
    // Total
    const totalText = `TOTAL: $${total.toLocaleString()}`;
    const totalWidth = boldFont.widthOfTextAtSize(totalText, 16);
    page.drawText(totalText, {
      x: this.pageWidth - this.margin - totalWidth,
      y: startY,
      size: 16,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    return startY - 40;
  }

  async addTermsAndConditions(page, companyData, template, regularFont, startY) {
  const companyName = template?.companyOverrides?.name || companyData.name || 'Your Company';
  const terms = (companyData.termsAndConditions || '').replace(/{companyName}/g, companyName);
  
  if (!terms) return startY;
  
  page.drawText('Terms and Conditions:', {
    x: this.margin,
    y: startY,
    size: 12,
    font: regularFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  
  startY -= 20;
  
  // ✅ FIX: Handle newlines properly first, then word wrap
  const paragraphs = terms.split('\n'); // Split by actual newlines first
  const lineHeight = 12;
  const maxWidth = this.contentWidth;
  
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      // Empty line - just add space
      startY -= lineHeight;
      continue;
    }
    
    // Word wrap within each paragraph
    const words = paragraph.trim().split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = regularFont.widthOfTextAtSize(testLine, 9);
      
      if (testWidth > maxWidth && currentLine) {
        page.drawText(currentLine, {
          x: this.margin,
          y: startY,
          size: 9,
          font: regularFont,
          color: rgb(0.4, 0.4, 0.4),
        });
        startY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Add the last line of the paragraph
    if (currentLine) {
      page.drawText(currentLine, {
        x: this.margin,
        y: startY,
        size: 9,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      startY -= lineHeight;
    }
    
    // Add extra space between paragraphs
    startY -= 5;
  }
  
  return startY - 15;
}

  async addSignatureSection(page, signatures, boldFont, regularFont, startY) {
    // Signature section header
    page.drawText('Signatures:', {
      x: this.margin,
      y: startY,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    startY -= 40;
    
    // Consultant signature area
    page.drawText('Consultant Signature:', {
      x: this.margin,
      y: startY,
      size: 11,
      font: regularFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Signature line for consultant
    page.drawLine({
      start: { x: this.margin, y: startY - 40 },
      end: { x: this.margin + 200, y: startY - 40 },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    
    if (signatures.consultant) {
      const signedDate = new Date(signatures.consultant.signedAt).toLocaleDateString();
      page.drawText(`Signed: ${signedDate}`, {
        x: this.margin,
        y: startY - 55,
        size: 9,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      
      page.drawText(`By: ${signatures.consultant.signedBy}`, {
        x: this.margin,
        y: startY - 70,
        size: 9,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    
    // Customer signature area
    const customerX = this.margin + 300;
    page.drawText('Customer Signature:', {
      x: customerX,
      y: startY,
      size: 11,
      font: regularFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Signature line for customer
    page.drawLine({
      start: { x: customerX, y: startY - 40 },
      end: { x: customerX + 200, y: startY - 40 },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    
    if (signatures.customer) {
      const signedDate = new Date(signatures.customer.signedAt).toLocaleDateString();
      page.drawText(`Signed: ${signedDate}`, {
        x: customerX,
        y: startY - 55,
        size: 9,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      
      page.drawText(`By: ${signatures.customer.signedBy}`, {
        x: customerX,
        y: startY - 70,
        size: 9,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    
    return startY - 100;
  }

  async embedSignatures(pdfDoc, page, signatures, currentY) {
    try {
      // Embed consultant signature
      if (signatures.consultant?.signature) {
        const consultantSigImage = await pdfDoc.embedPng(signatures.consultant.signature);
        const sigDims = consultantSigImage.scale(0.3);
        
        page.drawImage(consultantSigImage, {
          x: this.margin + 20,
          y: currentY + 60,
          width: sigDims.width,
          height: sigDims.height,
        });
      }
      
      // Embed customer signature
      if (signatures.customer?.signature) {
        const customerSigImage = await pdfDoc.embedPng(signatures.customer.signature);
        const sigDims = customerSigImage.scale(0.3);
        
        page.drawImage(customerSigImage, {
          x: this.margin + 320,
          y: currentY + 60,
          width: sigDims.width,
          height: sigDims.height,
        });
      }
    } catch (error) {
      console.warn('[PDF Generator] Could not embed signatures:', error);
      // Continue without signatures if embedding fails
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ) : rgb(0.18, 0.52, 0.67); // Default blue
  }
}

// Export the generator
export const quotePDFGenerator = new QuotePDFGenerator();