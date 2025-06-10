// scripts/setup-search-indexes.js
// Run this in MongoDB to create text indexes for global search

// Connect to your MongoDB database first
// use lpai;

// 1. Contacts - Create compound text index
db.contacts.createIndex({
  firstName: "text",
  lastName: "text",
  email: "text",
  phone: "text",
  companyName: "text"
}, {
  weights: {
    firstName: 10,
    lastName: 10,
    email: 5,
    companyName: 5,
    phone: 3
  },
  name: "contact_search_index"
});

// 2. Projects - Create compound text index
db.projects.createIndex({
  title: "text",
  notes: "text",
  scopeOfWork: "text",
  products: "text"
}, {
  weights: {
    title: 10,
    scopeOfWork: 5,
    products: 3,
    notes: 2
  },
  name: "project_search_index"
});

// 3. Quotes - Create compound text index
db.quotes.createIndex({
  quoteNumber: "text",
  title: "text",
  description: "text"
}, {
  weights: {
    quoteNumber: 15,
    title: 10,
    description: 3
  },
  name: "quote_search_index"
});

// 4. Appointments - Create compound text index
db.appointments.createIndex({
  title: "text",
  notes: "text",
  contactName: "text",
  address: "text"
}, {
  weights: {
    title: 10,
    contactName: 8,
    address: 3,
    notes: 2
  },
  name: "appointment_search_index"
});

// Also create regular indexes for better performance
db.contacts.createIndex({ locationId: 1, createdAt: -1 });
db.projects.createIndex({ locationId: 1, createdAt: -1 });
db.quotes.createIndex({ locationId: 1, createdAt: -1 });
db.appointments.createIndex({ locationId: 1, createdAt: -1 });

// Create compound indexes for common queries
db.contacts.createIndex({ locationId: 1, email: 1 });
db.projects.createIndex({ locationId: 1, status: 1 });
db.quotes.createIndex({ locationId: 1, status: 1 });
db.appointments.createIndex({ locationId: 1, start: 1 });

print("Search indexes created successfully!");