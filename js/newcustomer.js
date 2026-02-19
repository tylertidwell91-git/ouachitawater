// New customer form: submits to server, emailed to OSWater@ipa.net

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("new-customer-form");
  const status = document.getElementById("form-status");
  const submitBtn = document.getElementById("submit-btn");

  if (!form) return;

  const apiBase = window.location.origin;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.name?.value?.trim();
    const email = form.email?.value?.trim();
    if (!name || !email) {
      setStatus("Please enter your name and email.", "error");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
    }
    setStatus("Sending…", "");

    try {
      const res = await fetch(`${apiBase}/api/submit-new-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email,
          phone: form.phone?.value?.trim() || "",
          street: form.street?.value?.trim() || "",
          city: form.city?.value?.trim() || "",
          state: form.state?.value?.trim() || "",
          zip: form.zip?.value?.trim() || "",
          company: form.company?.value?.trim() || "",
          notes: form.notes?.value?.trim() || "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setStatus(data.message || "Thanks! We'll be in touch.", "success");
        form.reset();
      } else {
        setStatus(data.message || "Something went wrong. Please try again or email OSWater@ipa.net.", "error");
      }
    } catch (_) {
      setStatus("Could not reach the server. Please try again or contact us at OSWater@ipa.net.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit <span aria-hidden="true">↗</span>';
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
