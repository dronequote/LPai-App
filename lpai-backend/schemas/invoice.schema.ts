import * as yup from 'yup';

export const invoiceSchema = yup.object({
  altId: yup.string().required(),
  altType: yup.string().oneOf(['location']).required(),
  name: yup.string().required(),
  title: yup.string().required(),

  businessDetails: yup.object({
    logoUrl: yup.string().url(),
    name: yup.string().required(),
    phoneNo: yup.string(),
    address: yup.object({
      street: yup.string(),
      city: yup.string(),
      state: yup.string(),
      postalCode: yup.string(),
      country: yup.string(),
    }),
    website: yup.string().url()
  }).required(),

  customValues: yup.array(yup.string()).optional(),
  currency: yup.string().required(),

  items: yup.array(
    yup.object({
      name: yup.string().required(),
      description: yup.string().optional(),
      productId: yup.string().optional(),
      priceId: yup.string().optional(),
      currency: yup.string().required(),
      amount: yup.number().required(),
      qty: yup.number().required(),
      taxes: yup.array().optional(),
      isSetupFeeItem: yup.boolean().optional(),
      type: yup.string().oneOf(['one_time', 'recurring']),
      taxInclusive: yup.boolean(),
    })
  ).required(),

  discount: yup.object({
    value: yup.number().required(),
    type: yup.string().oneOf(['percentage', 'fixed']).required(),
    validOnProductIds: yup.array(yup.string()).optional(),
  }).optional(),

  termsNotes: yup.string().optional(),

  contactDetails: yup.object({
    id: yup.string().required(),
    name: yup.string().required(),
    phoneNo: yup.string(),
    email: yup.string().email(),
    companyName: yup.string(),
    address: yup.object({
      street: yup.string(),
      city: yup.string(),
      state: yup.string(),
      postalCode: yup.string(),
      country: yup.string(),
    }).optional(),
    additionalEmails: yup.array(
      yup.object({ email: yup.string().email().required() })
    ).optional(),
    customFields: yup.array(yup.string()).optional(),
  }),

  invoiceNumber: yup.string().optional(),
  invoiceNumberPrefix: yup.string().optional(),

  issueDate: yup.string().required(),
  dueDate: yup.string().required(),

  sentTo: yup.object({
    email: yup.array(yup.string().email()).required(),
    emailCc: yup.array(yup.string().email()).optional(),
    emailBcc: yup.array(yup.string().email()).optional(),
    phoneNo: yup.array(yup.string()).optional(),
  }).required(),

  liveMode: yup.boolean().required(),
  automaticTaxesEnabled: yup.boolean().optional(),

  tipsConfiguration: yup
    .object({
      tipsPercentage: yup.array(yup.number().oneOf([5, 10, 15])).notRequired(),
      tipsEnabled: yup.boolean().notRequired(),
    })
  .default(undefined),

  paymentMethods: yup.object({
    stripe: yup.object({
      enableBankDebitOnly: yup.boolean().required(),
    }).required(),
  }).default(undefined),

  attachments: yup.array(
    yup.object({
      id: yup.string().required(),
      name: yup.string().required(),
      url: yup.string().url().required(),
      type: yup.string().required(),
      size: yup.number().required(),
    })
  ).optional(),
});
