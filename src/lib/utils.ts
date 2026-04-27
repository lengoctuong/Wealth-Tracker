import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { subDays, subMonths, subYears, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: string = 'VND') {
  const upperCurrency = currency.toUpperCase();
  const isCrypto = ['USDT', 'BTC', 'ETH', 'SOL', 'BNB'].includes(upperCurrency);
  
  if (isCrypto) {
    return new Intl.NumberFormat('vi-VN', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 6 
    }).format(value) + ' ' + upperCurrency;
  }

  try {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: upperCurrency 
    }).format(value);
  } catch (e) {
    // Fallback for any other non-ISO currencies
    return new Intl.NumberFormat('vi-VN', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    }).format(value) + ' ' + upperCurrency;
  }
}

/**
 * Calculates the value of an asset based on its category and currency.
 */
export function getAssetValue(asset: any, usdtRate: number = 25500) {
  const isInvest = ["stock", "etf", "coin", "crypto", "fund", "position"].includes(asset.category);
  const isSimpleAsset = ["usdt", "bot", "position", "usdc"].includes(asset.category);
  
  const value = isInvest && !isSimpleAsset 
    ? (asset.quantity || 0) * (asset.currentPrice || 0) 
    : (asset.balance || 0);
    
  const multiplier = ['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? usdtRate : 1;
  
  return value * multiplier;
}

/**
 * Calculates the purchase value of an asset based on its category and currency.
 */
export function getPurchaseValue(asset: any, usdtRate: number = 25500) {
  const isInvest = ["stock", "etf", "coin", "crypto", "fund", "position"].includes(asset.category);
  const isSimpleAsset = ["usdt", "bot", "position", "usdc"].includes(asset.category);
  
  const value = isInvest && !isSimpleAsset 
    ? (asset.quantity || 0) * (asset.purchasePrice || asset.currentPrice || 0) 
    : (asset.balance || 0);
    
  const multiplier = ['USDT', 'USDC', 'USD'].includes(asset.currency?.toUpperCase()) ? usdtRate : 1;
  
  return value * multiplier;
}

/**
 * Removes undefined values from an object to prevent Firestore errors.
 */
export function sanitizeFirestoreData<T extends object>(data: T): T {
  const sanitized = { ...data } as any;
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeFirestoreData(sanitized[key]);
    }
  });
  return sanitized;
}

/**
 * Calculates the start date for a given time range.
 */
export function getStartDateForRange(range: string, now: Date = new Date()): Date {
  switch (range) {
    case '7d': return subDays(now, 7);
    case '30d': return subMonths(now, 1);
    case '3m': return subMonths(now, 3);
    case '6m': return subMonths(now, 6);
    case '1y': return subYears(now, 1);
    case '3y': return subYears(now, 3);
    case '5y': return subYears(now, 5);
    default: return new Date(0); // For 'all'
  }
}

/**
 * Finds the index of the entry in the data array that is closest to the target date.
 */
export function findStartIndexForDate(data: { date: string }[], startDate: Date): number {
  if (data.length === 0) return -1;
  
  let closestIndex = 0;
  let minDiff = Infinity;
  
  const targetTime = startDate.getTime();
  
  for (let i = 0; i < data.length; i++) {
    const dateTime = new Date(data[i].date).getTime();
    const diff = Math.abs(dateTime - targetTime);
    
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
    
    // Since data is sorted, we can break early if we passed the target and diff starts increasing
    if (dateTime > targetTime && diff > minDiff) {
      break;
    }
  }
  
  return closestIndex;
}

/**
 * Gets the standardized label for an asset category.
 */
export function getCategoryLabel(category: string, accountType?: string) {
  switch (category) {
    case 'saving': return "Tiết kiệm";
    case 'etf': return "ETF";
    case 'fund': return accountType === 'fintech' ? "Quỹ mở" : "Chứng chỉ quỹ";
    case 'stock': return "Cổ phiếu";
    case 'cash': return "Tiền mặt";
    case 'coin': return "Coin / Token";
    case 'usdt': return "USDT / Stablecoin";
    case 'bot': return "Bot Trading";
    default: 
      if (!category) return "";
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}
