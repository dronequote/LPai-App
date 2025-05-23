// /src/styles/theme.js

export const COLORS = {
  background: '#F8F9FB',
  card: '#fff',
  accent: '#00B3E6',
  accentMuted: '#E6F7FB',
  textDark: '#1A1F36',
  textGray: '#AAB2BD',
  textLight: '#B1B5BC',
  textRed: '#D7263D',
  calendarSelected: '#00B3E6',
  border: '#EEE',
  inputBg: '#F8F9FB',
  shadow: '#000',
  error: '#D7263D', // (same as textRed)
  // Add more as needed...
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
};

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
