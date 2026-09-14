import type { AggregatedMetrics } from '@/hooks/useAggregatedData';

export interface ParsedFilter {
  field: 'totalBudget' | 'totalHeadcount' | 'averagePerformance';
  operator: '>' | '<' | '>=' | '<=' | '=';
  value: number;
  rawQuery: string;
}

/**
 * Parses a natural language search query into a structured filter using Regex.
 * 
 * NLP Processing Flow:
 * - Detects target metrics: budget, performance, or headcount.
 * - Extracts mathematical operators: >, <, >=, <=, or =.
 * - Parses numeric values and handles scale multipliers like 'k' (thousand) or 'm' (million).
 * 
 * Returns a ParsedFilter object, or null if the pattern is unrecognized (which triggers
 * a fallback to standard full-text matching on department names).
 */
export function parseAISearch(query: string): ParsedFilter | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;

  // Regular expressions to detect parameters and extract conditional filters
  const budgetRegex = /(бюджет|budget|деньги|money)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)\s*(k|к|м|m|тыс|млн)?/i;
  const performanceRegex = /(эффективность|performance|perf|кпд)\s*(>=|<=|>|<|=)\s*(\d+)/i;
  const headcountRegex = /(штат|люди|сотрудники|people|headcount|чел)\s*(>=|<=|>|<|=)\s*(\d+)/i;

  // Converts numeric string scale suffixes (e.g. "500k") to absolute float values
  const parseNumericValue = (valStr: string, suffix?: string): number => {
    const base = parseFloat(valStr);
    if (!suffix) return base;
    
    if (suffix === 'k' || suffix === 'к' || suffix === 'тыс') {
      return base * 1000;
    }
    if (suffix === 'm' || suffix === 'м' || suffix === 'млн') {
      return base * 1000000;
    }
    return base;
  };

  // Attempt to match and parse Budget constraints
  const budgetMatch = trimmed.match(budgetRegex);
  if (budgetMatch) {
    const operator = budgetMatch[2] as ParsedFilter['operator'];
    const rawVal = budgetMatch[3];
    const suffix = budgetMatch[4];
    return {
      field: 'totalBudget',
      operator,
      value: parseNumericValue(rawVal, suffix),
      rawQuery: query,
    };
  }

  // Attempt to match and parse Performance constraints
  const perfMatch = trimmed.match(performanceRegex);
  if (perfMatch) {
    const operator = perfMatch[2] as ParsedFilter['operator'];
    const value = parseInt(perfMatch[3], 10);
    return {
      field: 'averagePerformance',
      operator,
      value,
      rawQuery: query,
    };
  }

  // Attempt to match and parse Headcount constraints
  const hcMatch = trimmed.match(headcountRegex);
  if (hcMatch) {
    const operator = hcMatch[2] as ParsedFilter['operator'];
    const value = parseInt(hcMatch[3], 10);
    return {
      field: 'totalHeadcount',
      operator,
      value,
      rawQuery: query,
    };
  }

  return null; // Query did not match any numeric filters; fall back to name search
}

/**
 * Checks if a given aggregated metric record matches the active parsed filter.
 */
export function applyParsedFilter(item: AggregatedMetrics, filter: ParsedFilter): boolean {
  const itemValue = item[filter.field];
  const filterValue = filter.value;

  switch (filter.operator) {
    case '>':
      return itemValue > filterValue;
    case '<':
      return itemValue < filterValue;
    case '>=':
      return itemValue >= filterValue;
    case '<=':
      return itemValue <= filterValue;
    case '=':
      return itemValue === filterValue;
    default:
      return false;
  }
}
