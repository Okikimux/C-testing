CARTOMUX branded authentication email templates

Files:
- supabase/email-templates/campusdrop-confirmation.html  (Confirm signup)
- supabase/email-templates/campusdrop-recovery.html      (Reset password)

In Supabase: Authentication > Emails > Templates
- Confirm signup: paste campusdrop-confirmation.html
- Reset password: paste campusdrop-recovery.html

The images in the emails (logo, MUXLAB logo) are loaded from your site using Supabase's
{{ .SiteURL }} variable, so they follow whatever Site URL is set in
Authentication > URL Configuration. After you deploy, check these open in a browser:
  <Site URL>/campora-app-icon.png
  <Site URL>/muxlab-logo.png
  <Site URL>/muxlab-logo-navy.png
The old public/campora-logo.png is no longer used by the emails.

The templates keep Supabase's {{ .ConfirmationURL }} and {{ .Email }} variables.
No Supabase settings, secrets, database schema or DNS records are changed by these files.
Remember to change the Subject lines in Supabase too, for example
"Verify your CARTOMUX email address" and "Reset your CARTOMUX password".
