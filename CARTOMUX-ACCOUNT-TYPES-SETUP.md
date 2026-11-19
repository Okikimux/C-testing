# Student & Vendor accounts – setup

## 1. Run the database update first
Open Supabase → SQL Editor → run `supabase/cartomux-account-types.sql` (safe to run twice), **then** deploy the app.

It adds `profiles.account_type` ('student' | 'vendor'), `business_name`, `business_category`, a guarded
`set_account_type()` function, and makes storefronts vendor-only at database level (RLS).
`profiles.role` (admin) is not touched.

Existing accounts: anyone with a storefront, or a non-student vendor verification, becomes a vendor. Everyone else is a student.

Until the SQL is run the app keeps working: account type is "unknown" and nothing is locked.

## 2. What differs
| | Student | Vendor |
|---|---|---|
| Register | picks "Student" | picks "Vendor" + business name (required), category (optional) |
| Profile | Buying & selling, Campus services, small "Selling as a business?" card | + Vendor tools (analytics, storefront), business name under the name |
| Storefront (/store/manage) | locked page with "Switch to a vendor account" | available (name pre-filled from business name) |
| Seller analytics | locked page | available |
| Verification | Student route only, ₦1,500 | Vendor route only, ₦2,000, business name/category pre-filled |
| Badge | "Student" pill | "Vendor" pill + business name (public profile, seller card, account menu) |

Account type can be changed in Settings → Account type (confirmation sheet). Switching to student hides the storefront (not deleted).
It cannot be changed with a plain profile update (database trigger), only through `set_account_type()`.

## 3. Change which features are vendor-only
Edit `FEATURES` in `lib/account-type.ts`, e.g. `analytics: ['student', 'vendor']` to open analytics to everyone.
Storefront write access is also enforced in the database (see section 5 of the SQL).

## 4. Google sign-up
The type chosen on the register page is carried through Google sign-in to the "Complete your profile" page, where it can still be changed and is saved.
