

## Rename "Payment Method" to "Receiving Channel" with Pakistan-Relevant Options

### What Changes

**Label**: "Payment Method" becomes **"Receiving Channel"** throughout the UI -- this better reflects the admin's perspective of *where money was received*.

**Dropdown Options** updated to Pakistan-relevant channels:
- Bank Account (for standard bank transfers)
- JazzCash
- EasyPaisa
- Western Union
- Remitly
- Cash
- Other

### Technical Details

**File: `src/pages/Payments.tsx`**

1. Rename the constant array from `PAYMENT_METHODS` to `RECEIVING_CHANNELS` with updated options:
   `['Bank Account', 'JazzCash', 'EasyPaisa', 'Western Union', 'Remitly', 'Cash', 'Other']`

2. Update the label text from `"Payment Method"` to `"Receiving Channel"`.

3. Update the placeholder from `"Select method..."` to `"Select channel..."`.

4. The underlying database column (`payment_method`) and form state key stay unchanged -- only the UI labels and options change. No migration needed.

**File: `src/pages/Reports.tsx`**
- No label changes needed here as it only reads the stored value for display.

