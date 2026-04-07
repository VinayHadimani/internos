export interface SalaryInfo {
  min: number | null;
  max: number | null;
  currency: string;
  period: 'yearly' | 'monthly' | 'hourly' | null;
  raw: string;
}

export function normalizeSalary(salaryText: string): SalaryInfo {
  if (!salaryText || salaryText.toLowerCase().includes('unpaid')) {
    return { min: 0, max: 0, currency: 'INR', period: 'monthly', raw: salaryText || '' };
  }

  // Extract numbers from salary string
  const numbers = salaryText.match(/\d[\d,]*/g);
  const parsedNumbers = numbers?.map(n => parseInt(n.replace(/,/g, ''), 10)) || [];

  // Detect currency
  let currency = 'INR';
  if (salaryText.includes('$')) currency = 'USD';
  else if (salaryText.includes('€')) currency = 'EUR';
  else if (salaryText.includes('£')) currency = 'GBP';

  // Detect period
  let period: SalaryInfo['period'] = 'yearly';
  if (salaryText.toLowerCase().includes('/month') || salaryText.toLowerCase().includes('monthly')) {
    period = 'monthly';
  } else if (salaryText.toLowerCase().includes('/hour') || salaryText.toLowerCase().includes('hourly')) {
    period = 'hourly';
  }

  return {
    min: parsedNumbers.length > 0 ? Math.min(...parsedNumbers) : null,
    max: parsedNumbers.length > 0 ? Math.max(...parsedNumbers) : null,
    currency,
    period,
    raw: salaryText
  };
}