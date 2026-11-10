# Appointment Email

This document explains how appointment-request email notifications work on the Natural Skin Care SA site.

## What Gets Emailed

When a visitor submits the appointment form, the site sends the request to the Supabase `submit-appointment` Edge Function. After the function validates the request and saves it to the `appointment_requests` table, it sends an email notification to the business.

The notification includes the visitor's name, email, phone, requested service, preferred date and time, and message. The visitor's email address is set as the reply-to address, so replies go directly to them.

This is an internal notification only. The function does not send an appointment confirmation email to the visitor.

## Email Provider and Sender

- Provider: [Resend](https://resend.com/)
- API endpoint: Resend's email API
- From address: `Natural Skin Care SA <appointments@naturalskincaresa.com>`
- Recipient: `NOTIFICATION_EMAIL`, or `skincarenpsa@gmail.com` if that setting is not provided
- Subject: `New appointment request from <visitor name>`

The sending domain must be configured and verified in Resend for the `appointments@naturalskincaresa.com` sender address to work.

## Configuration

Set these as Supabase Edge Function secrets for the project:

| Secret | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes for email delivery | Authenticates requests to Resend |
| `NOTIFICATION_EMAIL` | No | Business inbox that receives appointment notifications |

For example, with the Supabase CLI, set the secrets without putting their values in source control:

```sh
supabase secrets set RESEND_API_KEY=your_resend_api_key NOTIFICATION_EMAIL=your_inbox@example.com
```

The example values above are placeholders. Keep the actual API key private. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are also used by the Edge Function to access the database; manage those through the Supabase function environment, not the frontend.

After changing function code, deploy the `submit-appointment` function to the Supabase project. Updating secrets does not require adding them to the Vite frontend environment.

## Delivery Behavior

1. The Edge Function checks the request and Turnstile policy.
2. It inserts the appointment request into the database.
3. If `RESEND_API_KEY` is configured, it sends the notification through Resend.
4. It returns success after the request is saved.

Email delivery is best-effort and happens after the database insert. If the key is missing or Resend rejects the request, the function logs the issue, but the already-saved appointment still receives a successful response. There is currently no automatic email retry or visitor confirmation email, so check the database as well as email logs when investigating a missing notification.

## Troubleshooting

- **No notification arrived:** Confirm `RESEND_API_KEY` and `NOTIFICATION_EMAIL` are set in the correct Supabase project, then inspect the `submit-appointment` Edge Function logs.
- **Logs say the key is not configured:** Set `RESEND_API_KEY` as a Supabase Edge Function secret.
- **Resend returns an error:** Check the logged HTTP status and response details, the API key's validity, and that the sender domain is verified in Resend.
- **The request is missing from the database:** This is a submission/database issue rather than an email delivery issue. Check the function logs for `Insert failed` and verify the function's Supabase database configuration.
- **Need to change the receiving inbox:** Set `NOTIFICATION_EMAIL` to the new address in Supabase. If it is unset, the code uses `skincarenpsa@gmail.com`.

## Code Location

The email construction, Resend request, and appointment submission flow are in `supabase/functions/submit-appointment/index.ts`.