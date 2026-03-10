import test from "node:test";
import assert from "node:assert/strict";
import { parseReceiptText } from "./receipt-parser";

test("extracts merchant and total from a typical receipt", () => {
  const rawText = `
    UBER BV
    Trip receipt
    05/03/2026 22:14
    Subtotal 21,00
    Total 24,00
    Card 24,00
  `;

  const parsed = parseReceiptText(rawText);
  assert.equal(parsed.merchant, "UBER BV");
  assert.equal(parsed.amount, 24);
  assert.equal(parsed.date, "2026-03-05");
});

test("does not confuse subtotal or change with total", () => {
  const rawText = `
    PIZZERIA ROMA
    Calle Mayor 12
    2026-03-06
    Subtotal 18.50
    VAT 1.50
    CASH 30.00
    CHANGE 10.00
    GRAND TOTAL 20.00
  `;

  const parsed = parseReceiptText(rawText);
  assert.equal(parsed.merchant, "PIZZERIA ROMA");
  assert.equal(parsed.amount, 20);
});

test("falls back to the last plausible amount in the lower half", () => {
  const rawText = `
    SHOP NAME
    TEL 123456789
    item a 3,50
    item b 4,75
    amount due 8,25
  `;

  const parsed = parseReceiptText(rawText);
  assert.equal(parsed.amount, 8.25);
});
