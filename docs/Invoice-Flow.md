****************Create Product****************

const axios = require('axios').default;

const options = {
  method: 'POST',
  url: 'https://services.leadconnectorhq.com/products/',
  headers: {
    Authorization: 'Bearer pit-3e69d6a2-c4f0-4445-84fa-043015551fbe',
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  data: {
    name: 'Deposit for QuoteId XXXXXX',
    locationId: 'JMtlZzwrNOUmLpJk2eCE',
    description: 'Deposit for Project XXXXXX.',
    productType: 'SERVICE',
    availableInStore: true
  }
};

try {
  const { data } = await axios.request(options);
  console.log(data);
} catch (error) {
  console.error(error);
}

****************Response****************

{
  "type": "object",
  "parentId": null,
  "archived": false,
  "deleted": false,
  "medias": [],
  "variants": [],
  "isTaxesEnabled": false,
  "taxes": [],
  "isLabelEnabled": false,
  "collectionIds": [],
  "rating": [],
  "excludedStoreIds": [],
  "displayPriority": [],
  "_id": "6837a3a7b98b7461e980d178",
  "name": "Deposit for QuoteId XXXXXX",
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "description": "Deposit for Project XXXXXX.",
  "productType": "SERVICE",
  "availableInStore": true,
  "createdAt": "2025-05-29T00:00:39.388Z",
  "updatedAt": "2025-05-29T00:00:39.388Z",
  "__v": 0,
  "prices": [],
  "traceId": "c79b5201-2e53-4916-ae8a-1356172672c1"
}

****************Set Price****************

const axios = require('axios').default;

const options = {
  method: 'POST',
  url: 'https://services.leadconnectorhq.com/products/6837a3a7b98b7461e980d178/price',
  headers: {
    Authorization: 'Bearer pit-3e69d6a2-c4f0-4445-84fa-043015551fbe',
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  data: {
    name: 'Price Name',
    type: 'one_time',
    currency: 'USD',
    amount: 500,
    locationId: 'JMtlZzwrNOUmLpJk2eCE'
  }
};

try {
  const { data } = await axios.request(options);
  console.log(data);
} catch (error) {
  console.error(error);
}

****************Response****************

{
  "membershipOffers": [],
  "deleted": false,
  "variantOptionIds": [],
  "trackInventory": false,
  "_id": "6837a4e214bd7b7d95e06765",
  "name": "Price Name",
  "type": "one_time",
  "currency": "USD",
  "amount": 500,
  "locationId": "JMtlZzwrNOUmLpJk2eCE",
  "product": "6837a3a7b98b7461e980d178",
  "createdAt": "2025-05-29T00:05:54.610Z",
  "updatedAt": "2025-05-29T00:05:54.610Z",
  "__v": 0
}

****************Create Invoice****************

const axios = require('axios').default;

const options = {
  method: 'POST',
  url: 'https://services.leadconnectorhq.com/invoices/',
  headers: {
    Authorization: 'Bearer pit-3e69d6a2-c4f0-4445-84fa-043015551fbe',
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  data: {
    altId: 'JMtlZzwrNOUmLpJk2eCE',
    altType: 'location',
    name: 'PRODUCT NAME',
    businessDetails: {name: 'Location.Name', website: 'wwww.example.com'},
    currency: 'USD',
    items: [
      {name: 'Deposit', description: 'Deposit', currency: 'USD', amount: 999, qty: 1}
    ],
    discount: {value: 0, type: 'percentage'},
    contactDetails: {
      id: 'kSW267cUGxl5WwBoS8Q4',
      name: 'Client',
      phoneNo: '+1234567890',
      email: 'info@DroneQuote.net'
    },
    invoiceNumber: '1001',
    issueDate: '2025-05-28',
    dueDate: '2025-05-28',
    sentTo: {email: ['info@dronquote.net']},
    liveMode: true,
    invoiceNumberPrefix: 'DEP-',
    paymentMethods: {stripe: {enableBankDebitOnly: false}}
  }
};

try {
  const { data } = await axios.request(options);
  console.log(data);
} catch (error) {
  console.error(error);
}

****************Response****************

{
  "status": "draft",
  "discount": {
    "value": 0,
    "type": "percentage"
  },
  "liveMode": true,
  "amountPaid": 0,
  "attachments": [],
  "_id": "6837a9c0d092326e9ad3ab6f",
  "altId": "JMtlZzwrNOUmLpJk2eCE",
  "altType": "location",
  "companyId": "xvoQk4MIRt1U9L3bWLcC",
  "name": "PRODUCT NAME",
  "businessDetails": {
    "name": "Location.Name",
    "website": "wwww.example.com"
  },
  "invoiceNumber": "1001",
  "currency": "USD",
  "contactDetails": {
    "id": "kSW267cUGxl5WwBoS8Q4",
    "name": "Client",
    "phoneNo": "+1234567890",
    "email": "info@DroneQuote.net"
  },
  "issueDate": "2025-05-28T07:00:00.000Z",
  "dueDate": "2025-05-29T06:59:59.999Z",
  "sentTo": {
    "email": [
      "info@dronquote.net"
    ]
  },
  "invoiceItems": [
    {
      "taxes": [],
      "taxInclusive": false,
      "_id": "6837a9c0d092326fb1d3ab70",
      "name": "Deposit",
      "description": "Deposit",
      "currency": "USD",
      "amount": 999,
      "qty": 1
    }
  ],
  "total": 999,
  "invoiceTotal": 999,
  "amountDue": 999,
  "automaticTaxesCalculated": false,
  "invoiceNumberPrefix": "DEP-",
  "paymentMethods": {
    "stripe": {
      "enableBankDebitOnly": false
    }
  },
  "syncDetails": [],
  "tipsReceived": [],
  "externalTransactions": [],
  "createdAt": "2025-05-29T00:26:40.586Z",
  "updatedAt": "2025-05-29T00:26:40.586Z",
  "traceId": "1843c492-9a65-4601-ad98-9b656f9caf9c"
}

Invoice Link: https://updates.leadprospecting.ai/invoice/6837a9c0d092326e9ad3ab6f