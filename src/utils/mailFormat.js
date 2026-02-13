const emailTemplate = ({
  title = "Notification from CONVOC",
  subtitle = "",
  code = null,
  codeLabel = "Your Code",
  expiresIn = null,
  description = "",
  buttonLink = "localhost:5173/",
  footerNote = "If you didn’t request this, you can safely ignore this email.",
}) => {

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>

  <style>
    body { margin: 0; padding: 0; background-color:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    table { border-collapse: collapse; }
    @media (max-width:600px) {
      .otp-code { font-size: 32px !important; letter-spacing: 8px !important; }
    }
  </style>
</head>

<body>
<table width="100%" role="presentation">
  <tr>
    <td align="center" style="padding:32px 0;">

      <table width="100%" style="max-width:520px; background:#1e293b; border-radius:16px; border:1px solid rgba(255,255,255,0.08);">

        <!-- Header -->
        <tr>
          <td align="center" style="padding:40px 32px 24px;">
            <h1 style="margin:0; font-size:28px; color:#f1f5f9;">${title}</h1>
            ${subtitle ? `<p style="margin-top:8px; color:#94a3b8;">${subtitle}</p>` : ""}
          </td>
        </tr>

        <!-- Description -->
        ${description ? `
        <tr>
          <td style="padding:0 40px 24px; text-align:center; color:#cbd5e1; line-height:1.6;">
            ${description}
          </td>
        </tr>` : ""}

        <!-- Code Block -->
        ${code ? `
        <tr>
          <td align="center" style="padding:16px 30px 32px;">
            <div style="
              background: rgba(51,65,85,0.6);
              border-radius:12px;
              padding:24px 32px;
              font-size:38px;
              font-weight:700;
              letter-spacing:12px;
              color:#e2e8f0;
              border:1px solid rgba(168,85,247,0.3);
              font-family:monospace;
            " class="otp-code">
              ${code}
            </div>
            <p style="margin-top:12px; font-size:14px; color:#94a3b8;">
              ${codeLabel}
            </p>
          </td>
        </tr>` : ""}

        <!-- Expiry -->
        ${expiresIn ? `
        <tr>
          <td align="center" style="padding-bottom:24px; color:#cbd5e1;">
            This code will expire in <strong>${expiresIn}</strong>
          </td>
        </tr>` : ""}

        <!-- Button -->
        ${buttonLink ? `
        <tr>
          <td align="center" style="padding-bottom:40px;">
            <a href="${buttonLink}" style="
              display:inline-block;
              background:linear-gradient(90deg,#7c3aed,#a855f7);
              color:#fff;
              padding:14px 40px;
              border-radius:12px;
              text-decoration:none;
              font-weight:600;
            ">
              VISIT CONVOC
            </a>
          </td>
        </tr>` : ""}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px; text-align:center; font-size:13px; color:#64748b; background:rgba(15,23,42,0.6);">
            ${footerNote}<br/><br/>
            © 2025 CONVOC. All rights reserved.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>
`;
};

module.exports = emailTemplate;
