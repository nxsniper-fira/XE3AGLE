export const prices = [
  {
    name: 'Free',
    price: '$0',
    description: 'For traders starting to build structure.',
    perks: ['1 account', 'Basic daily review', 'Risk engine active'],
  },
  {
    name: 'PRO',
    price: '$49',
    description: 'For serious execution and accountability.',
    perks: ['3 accounts', 'Analytics', 'Weekly Telegram summary'],
  },
  {
    name: 'PRO+',
    price: '$99',
    description: 'For advanced journaling and account management.',
    perks: ['15 accounts', 'Custom risk per account', 'CSV import/export', 'Playbook library'],
  },
];

export const disciplineSteps = [
  'Prepare',
  'Analysis',
  'Pre-Trade',
  'Trade',
  'Review',
];

export const dashboardStats = [
  { label: 'Daily P&L', value: '+$420' },
  { label: 'Discipline Score', value: '86' },
  { label: 'Current Streak', value: '9 days' },
  { label: 'Trades Left', value: '2' },
];

export const adminPayments = [
  { id: 'pay_1021', user: 'Marta H.', amount: '$49', method: 'Telebirr', status: 'Pending' },
  { id: 'pay_1022', user: 'Jonas K.', amount: '$99', method: 'CBE', status: 'Pending' },
  { id: 'pay_1030', user: 'N. Dawit', amount: '$49', method: 'Bank', status: 'Approved' },
];
