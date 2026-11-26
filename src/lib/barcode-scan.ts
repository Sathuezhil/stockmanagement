export function isBarcodeScan(value: string) {
  return /^\d{6,}$/.test(value.trim());
}

export function noteScanKey(times: number[], key: string) {
  const now = Date.now();
  if (times.length > 0 && now - times[times.length - 1] > 60) times.length = 0;
  if (key.length === 1) times.push(now);
}

export function isFastScan(times: number[]) {
  return times.length >= 6 && times[times.length - 1] - times[0] <= 350;
}

export type BarcodeProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  location: string | null;
  quantity: number;
  sellingPrice: number;
  purchasePrice: number;
};

export async function findProductByBarcode(code: string) {
  const response = await fetch(`/api/products/search?q=${encodeURIComponent(code.trim())}&exact=1`);
  if (!response.ok) return null;
  const hits = (await response.json()) as BarcodeProduct[];
  return hits[0] ?? null;
}
