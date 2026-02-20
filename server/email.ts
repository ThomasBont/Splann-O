export async function sendWelcomeEmail(toEmail: string, displayName: string): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.log(`[email stub] Welcome email for ${toEmail} (${displayName})`);
    return;
  }

  const name = displayName || "Asador";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "The Ortega Asado App <noreply@resend.dev>",
        to: [toEmail],
        subject: "Welcome to The Ortega Asado App! 🔥",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #e05c2a;">🔥 The Ortega Asado App</h2>
            <p>Hey <strong>${name}</strong>, welcome aboard!</p>
            <p>Your account has been successfully created. You're all set to start tracking your BBQ expenses, invite friends, and split the costs like a pro.</p>
            <p style="margin: 20px 0;">Fire up the grill and enjoy! 🥩🍖</p>
            <p style="color:#888;font-size:13px;">— The Ortega Asado Team</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Welcome email error:", body);
    }
  } catch (err) {
    console.error("[email] Failed to send welcome email:", err);
  }
}

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.log(`[email stub] Password reset link for ${toEmail}: ${resetUrl}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Ortega Asado App <noreply@resend.dev>",
      to: [toEmail],
      subject: "Reset your password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #e05c2a;">🔥 The Ortega Asado App</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#e05c2a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Reset Password
          </a>
          <p style="color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request this, just ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend error:", body);
    throw new Error("Failed to send email");
  }
}
