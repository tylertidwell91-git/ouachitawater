// Bill pay: Stripe card required, then server emails OSWater@ipa.net and sends receipt to customer.

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("bill-pay-form");
  const status = document.getElementById("bill-pay-status");
  const submitBtn = document.getElementById("submit-btn");
  const cardElementContainer = document.getElementById("card-element");
  const cardErrorsEl = document.getElementById("card-errors");

  if (!form) return;

  const apiBase = window.location.origin;
  let stripe = null;
  let cardElement = null;

  // Load Stripe config and mount card element
  try {
    const configRes = await fetch(`${apiBase}/api/config`);
    const config = await configRes.json().catch(() => ({}));
    const publishableKey = config.stripePublishableKey;

    if (!publishableKey || typeof window.Stripe !== "function") {
      cardErrorsEl.textContent = "Payment form is not available. Please contact us to pay your bill.";
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    stripe = window.Stripe(publishableKey);
    const elements = stripe.elements();
    const style = {
      base: {
        fontSize: "16px",
        color: "#1a202c",
        "::placeholder": { color: "#94a3b8" },
      },
      invalid: {
        color: "#b91c1c",
      },
    };
    cardElement = elements.create("card", { style });
    cardElement.mount(cardElementContainer);

    cardElement.on("change", (e) => {
      cardErrorsEl.textContent = e.error ? e.error.message : "";
    });
  } catch (e) {
    cardErrorsEl.textContent = "Could not load payment form. Please refresh or contact us.";
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const customerName = form.customerName?.value?.trim();
    const street = form.street?.value?.trim();
    const city = form.city?.value?.trim();
    const state = form.state?.value?.trim();
    const zip = form.zip?.value?.trim();
    const amount = form.amount?.value?.trim();
    const receiptEmail = form.receiptEmail?.value?.trim();

    if (!customerName || !street || !city || !state || !zip || !amount || !receiptEmail) {
      setStatus("Please fill in all fields before submitting.", "error");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0.5) {
      setStatus("Please enter a valid payment amount (minimum $0.50).", "error");
      return;
    }

    if (!stripe || !cardElement) {
      setStatus("Payment form is not ready. Please refresh the page.", "error");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing payment…";
    }
    setStatus("", "");
    cardErrorsEl.textContent = "";

    try {
      // 1. Create PaymentIntent
      const intentRes = await fetch(`${apiBase}/api/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount }),
      });
      const intentData = await intentRes.json().catch(() => ({}));
      if (!intentRes.ok || !intentData.clientSecret) {
        setStatus(intentData.message || "Could not start payment. Please try again.", "error");
        return;
      }

      // 2. Confirm card payment with full billing details (required before submit)
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        intentData.clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: customerName,
              address: {
                line1: street,
                city: city,
                state: state,
                postal_code: zip,
                country: "US",
              },
            },
          },
        }
      );

      if (confirmError) {
        cardErrorsEl.textContent = confirmError.message || "Card payment failed.";
        setStatus("Please correct your card details and try again.", "error");
        return;
      }

      if (paymentIntent.status !== "succeeded") {
        setStatus("Payment was not completed. Please try again.", "error");
        return;
      }

      setStatus("Payment received. Sending your receipt…", "");

      // 3. Submit bill (emails to OSWater@ipa.net + receipt to customer)
      const res = await fetch(`${apiBase}/api/submit-bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          street,
          city,
          state,
          zip,
          amount: numAmount,
          receiptEmail,
          paymentIntentId: paymentIntent.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setStatus(data.message || "Done! Check your email for a receipt.", "success");
        form.reset();
        if (cardElement) cardElement.clear();
      } else {
        setStatus(
          data.message || "Something went wrong. Please contact us. Your card was not charged again.",
          "error"
        );
      }
    } catch (_) {
      setStatus(
        "Could not reach the server. Please check your connection and try again.",
        "error"
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit payment <span aria-hidden="true">↗</span>';
      }
    }
  });

  function setStatus(text, type) {
    if (!status) return;
    status.textContent = text;
    status.className =
      "status-note" +
      (type === "success" ? " status-success" : type === "error" ? " status-error" : "");
  }
});
