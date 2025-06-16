import * as yup from 'yup';

export const createInvoiceSchema = yup.object({
  projectId: yup.string().required(),
  locationId: yup.string().required(),
  title: yup.string().required(),
  amount: yup.number().required(),
  type: yup.string().oneOf(['deposit', 'progress', 'final']).required(),
  amountPaid: yup.number().default(0),
  amountDue: yup.number().default(0),
  invoiceTotal: yup.number().required(),
  total: yup.number().required(),
  currency: yup.string().default('USD'),
  status: yup.string().oneOf(['pending', 'paid']).required()
});
