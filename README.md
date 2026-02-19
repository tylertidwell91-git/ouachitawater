Ouachita Spring Water Co. – Website
===================================

Two-page site: About/Contact and Bill Pay. Submitting the bill pay form emails the submission to **OSWater@ipa.net** and sends an automatic receipt to the customer’s email.

## Pages

- **About / Contact** (`index.html`) – Company overview and contact info.
- **Bill Pay** (`bill-pay.html`) – Form collects customer name, address, payment amount, and email for receipt. On submit, the server sends one email to OSWater@ipa.net and a receipt to the customer.

## Running the site (with email)

1. Copy `.env.example` to `.env` and set your SMTP settings (e.g. for ipa.net or your provider).
2. `npm install` then `npm start`.
3. Open `http://localhost:3000/bill-pay.html` (or `index.html`). Submitting the form will send the two emails.

Without the server, you can still open the HTML files in a browser, but form submit will fail until the API is available.

## Structure

- `index.html`, `bill-pay.html` – Static pages
- `assets/css/styles.css` – Global styles
- `js/billpay.js` – Bill pay form submit (POST to `/api/submit-bill`)
- `server.js` – Express server: serves static files and `POST /api/submit-bill` (emails via Nodemailer)
- `.env.example` – Example env for SMTP (copy to `.env`)

