require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
const Stripe = require("stripe");

const app = express();
const PORT = process.env.PORT || 3000;

const BILL_EMAIL = "OSWater@ipa.net";
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// SMTP: set in .env (e.g. SMTP_HOST=mail.ipa.net, SMTP_USER, SMTP_PASS, FROM_EMAIL)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ipa.net",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

const fromEmail = process.env.FROM_EMAIL || "OSWater@ipa.net";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Publishable key for Stripe.js on the frontend (no secret key exposed)
app.get("/api/config", (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
  });
});

// Create a PaymentIntent so the client can collect card and confirm payment
app.post("/api/create-payment-intent", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      message: "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in .env.",
    });
  }
  const { amount } = req.body || {};
  const amountCents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 50) {
    return res.status(400).json({
      success: false,
      message: "Invalid amount. Minimum is $0.50.",
    });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Stripe create PaymentIntent error:", err);
    res.status(500).json({ success: false, message: "Failed to create payment session." });
  }
});

app.post("/api/submit-bill", async (req, res) => {
  const { customerName, street, city, state, zip, amount, receiptEmail, paymentIntentId } =
    req.body || {};

  if (!customerName || !street || !city || !state || !zip || amount == null || !receiptEmail) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: customerName, street, city, state, zip, amount, receiptEmail.",
    });
  }

  if (!paymentIntentId) {
    return res.status(400).json({
      success: false,
      message: "Payment is required. Please enter your card and complete payment before submitting.",
    });
  }

  if (stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          success: false,
          message: "Payment was not completed. Please complete card payment and try again.",
        });
      }
    } catch (err) {
      console.error("Stripe retrieve PaymentIntent error:", err);
      return res.status(400).json({
        success: false,
        message: "Invalid payment. Please complete card payment and try again.",
      });
    }
  }

  const address = [street, city, state, zip].filter(Boolean).join(", ");
  const amountStr = typeof amount === "number" ? `$${Number(amount).toFixed(2)}` : `$${String(amount)}`;

  try {
    // 1. Email to OSWater@ipa.net with submission details
    await transporter.sendMail({
      from: fromEmail,
      to: BILL_EMAIL,
      subject: `Bill pay submission: ${customerName} – ${amountStr}`,
      text: [
        "Bill pay submission from website",
        "",
        "Customer name: " + customerName,
        "Address: " + address,
        "Payment amount: " + amountStr,
        "Receipt email: " + receiptEmail,
        "",
        "Submitted at: " + new Date().toISOString(),
      ].join("\n"),
      html: [
        "<h2>Bill pay submission</h2>",
        "<p><strong>Customer name:</strong> " + escapeHtml(customerName) + "</p>",
        "<p><strong>Address:</strong> " + escapeHtml(address) + "</p>",
        "<p><strong>Payment amount:</strong> " + escapeHtml(amountStr) + "</p>",
        "<p><strong>Receipt email:</strong> " + escapeHtml(receiptEmail) + "</p>",
        "<p><em>Submitted at: " + new Date().toISOString() + "</em></p>",
      ].join(""),
    });

    // 2. Receipt to customer
    await transporter.sendMail({
      from: fromEmail,
      to: receiptEmail,
      subject: `Ouachita Spring Water Co. – Payment receipt for ${amountStr}`,
      text: [
        "Thank you for your payment submission.",
        "",
        "Ouachita Spring Water Co. has received the following:",
        "",
        "Customer: " + customerName,
        "Address: " + address,
        "Amount: " + amountStr,
        "",
        "We will process this and contact you if we need anything else.",
        "",
        "— Ouachita Spring Water Co.",
      ].join("\n"),
      html: [
        "<h2>Payment receipt</h2>",
        "<p>Thank you for your payment submission.</p>",
        "<p><strong>Customer:</strong> " + escapeHtml(customerName) + "</p>",
        "<p><strong>Address:</strong> " + escapeHtml(address) + "</p>",
        "<p><strong>Amount:</strong> " + escapeHtml(amountStr) + "</p>",
        "<p>We will process this and contact you if we need anything else.</p>",
        "<p>— Ouachita Spring Water Co.</p>",
      ].join(""),
    });

    res.json({ success: true, message: "Submission sent. Check your email for a receipt." });
  } catch (err) {
    console.error("Send mail error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send submission. Please try again or contact us directly.",
    });
  }
});

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Bill pay form: http://localhost:${PORT}/bill-pay.html`);
});
