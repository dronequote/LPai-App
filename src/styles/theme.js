// /src/styles/theme.js

export const COLORS = {
  background: '#F5F5F5',
  card: '#fff',
  accent: '#1E88E5',        // Professional blue
  accentDark: '#1565C0',    // Darker blue
  accentMuted: '#E3F2FD',   // Light blue background
  textDark: '#212121',      // Almost black for better contrast
  textGray: '#757575',      // Medium gray
  textLight: '#9E9E9E',     // Light gray
  textRed: '#E53935',       // Error/danger red
  calendarSelected: '#1E88E5', // Match accent
  border: '#E0E0E0',
  inputBg: '#F5F5F5',
  shadow: '#000',
  error: '#E53935',         // Red
  success: '#43A047',       // Green
  warning: '#FB8C00',       // Orange
  
  // Action button colors - professional palette
  actionPhoto: '#1E88E5',    // Blue
  actionQuote: '#43A047',    // Green
  actionPayment: '#7B1FA2',  // Purple
  actionSchedule: '#FB8C00', // Orange
};

export const FONT = {
  header: 28,
  sectionTitle: 18,
  appointmentTitle: 16,
  meta: 14,
  type: 13,
  label: 15,     // for input labels
  input: 16,     // for all inputs
};

export const RADIUS = {
  card: 12,
  button: 8,    // use 8 for most buttons
  fab: 28,
  modal: 18,
  pill: 8,
  input: 8,
};

export const INPUT = {
  minHeight: 48,
  borderRadius: RADIUS.input,
  fontSize: FONT.input,
  padding: 12,
  marginBottom: 14,
};

export const SHADOW = {
  card: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fab: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  dropdown: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
};

// Z-INDEX SYSTEM for proper layering
export const Z_INDEX = {
  // Base content layers
  content: 1,
  header: 10,
  
  // Modal and overlay layers  
  modal: 100,
  modalContent: 101,
  
  // Dropdown system - use these for consistent layering
  dropdown1: 200,    // First dropdown in a form
  dropdown2: 300,    // Second dropdown  
  dropdown3: 400,    // Third dropdown
  dropdown4: 500,    // Fourth dropdown
  dropdown5: 600,    // Fifth dropdown
  
  // Toast and alerts
  toast: 1000,
  alert: 1100,
};

// DROPDOWN STYLES - reusable across all screens/modals
export const DROPDOWN = {
  container: {
    position: 'relative',
  },
  
  button: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  buttonText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    flex: 1,
  },
  
  // Overlay that positions above everything
  overlay: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 160, // Limit to ~4 items (40px each)
    ...SHADOW.dropdown,
  },
  
  item: {
    padding: 12,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  
  itemText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  
  // Helper function to get z-index styles for specific dropdown
  getZIndex: (level) => ({
    zIndex: Z_INDEX[`dropdown${level}`],
    elevation: Z_INDEX[`dropdown${level}`], // Android
  }),
};

// COMMON DROPDOWN OPTIONS - reusable across screens
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 'Custom'];

export const LOCATION_OPTIONS = [
  { label: 'Contact Address', value: 'address' },
  { label: 'Phone Call', value: 'phone' },
  { label: 'Google Meet', value: 'gmeet' },
  { label: 'Custom Location', value: 'custom' },
];

// Optionally: pills for option selectors (duration, calendars, etc)
export const PILL = {
  base: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accentMuted,
    marginHorizontal: 4,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: COLORS.accent,
  },
};