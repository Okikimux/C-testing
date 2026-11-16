# CAMPORA update notes

Included: responsive mobile floating plus alignment fix, compact marketplace cards, New/Used condition selector and badges, offline fallback page and network status, service-worker registration and shell caching, floating contact support panel with WhatsApp/email env configuration, and student/vendor verification UI.

## Before deployment
1. Apply `supabase/campora-marketplace-verification-support.sql` in Supabase after reviewing current RLS policies.
2. Keep the `verification-documents` storage bucket private. Restrict NIN/document reads to the submitting user and authorised admins. Do not expose NIN fields in public queries.
3. Set `NEXT_PUBLIC_CAMPORA_SUPPORT_WHATSAPP` to the full international WhatsApp number with digits only (for example 2348012345678), and `NEXT_PUBLIC_CAMPORA_SUPPORT_EMAIL` to the monitored support email.
4. Test iPhone Safari specifically: the raised plus icon is positioned relative to the centre of its own navigation grid column and uses zero icon margin/transform.
5. Verify the `user_feedback` table accepts nullable user_id and has appropriate RLS policies for signed-in and anonymous submissions. The widget currently submits through the existing feedback table; anonymous insertion requires an existing safe policy.
6. Build/test with `npm run typecheck` and `npm run build` before deploying.

## Verification privacy
The vendor form requests NIN and a NIN document, but full NIN collection is sensitive. Confirm lawful purpose, user notice, retention/deletion, access restrictions and a less intrusive alternative before enabling collection in production.
