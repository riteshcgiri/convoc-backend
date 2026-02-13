const emailTemplate = (otp) => {

    return `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>CONVOC Account Verification Code</title>

  <!-- Prevent auto-scaling in iOS Mail -->
  <style type="text/css">
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { color: inherit; }
    @media only screen and (max-width: 600px) {
      .mobile-padding { padding: 24px 16px !important; }
      .otp-code { font-size: 32px !important; letter-spacing: 8px !important; }
      .container { width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <!-- Main Wrapper -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;">
    <tr>
      <td align="center" style="padding: 32px 0;">

        <!-- Container -->
        <table role="presentation" class="container" width="100%" style="max-width: 520px; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
          
          <!-- Header / Brand -->
          <tr>
            <td align="center" style="padding: 40px 0 24px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="
                    width: 60px;
                    height: 60px;
                    background: white;
                    border-radius: 14px;
                    font-size: 32px;
                    font-weight: bold;
                    color: white;
                    text-align: center;
                    line-height: 60px;
                    display : relative;
                  ">
                    <svg width="110" height="91" viewBox="0 0 110 91" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 44.58C0 39.0572 4.47715 34.58 10 34.58H82.2581C87.7809 34.58 92.2581 39.0572 92.2581 44.58V54.61C92.2581 60.1329 87.7809 64.61 82.2581 64.61H12.7904C10.784 64.61 9.07095 66.0591 8.73839 68.0378C7.97654 72.5707 1.48156 72.6236 0.645936 68.1038L0.0776651 65.0301C0.0259967 64.7506 0 64.467 0 64.1828V44.58Z" fill="#5877AD"/>
                        <path d="M110 9.99999C110 4.47714 105.523 0 100 0H27.7419C22.2191 0 17.7419 4.47715 17.7419 10V20.03C17.7419 25.5529 22.2191 30.03 27.7419 30.03H97.2096C99.216 30.03 100.929 31.4791 101.262 33.4578C102.023 37.9906 108.518 38.0436 109.354 33.5238L109.922 30.4501C109.974 30.1706 110 29.887 110 29.6028V9.99999Z" fill="white"/>
                        <path d="M110 9.99999C110 4.47714 105.523 0 100 0H27.7419C22.2191 0 17.7419 4.47715 17.7419 10V20.03C17.7419 25.5529 22.2191 30.03 27.7419 30.03H97.2096C99.216 30.03 100.929 31.4791 101.262 33.4578C102.023 37.9906 108.518 38.0436 109.354 33.5238L109.922 30.4501C109.974 30.1706 110 29.887 110 29.6028V9.99999Z" fill="#6A67C2"/>
                    </svg>

                  </td>
                </tr>
              </table>
              <h1 style="margin: 20px 0 8px; font-size: 28px; font-weight: 600; color: #f1f5f9;">Verify Your Email</h1>
              <p style="margin: 0; font-size: 15px; color: #94a3b8;">
                Enter this code to continue
              </p>
            </td>
          </tr>

          <!-- OTP Code -->
          <tr>
            <td align="center" style="padding: 0 30px 40px;">
              <div style="
                background: rgba(51,65,85,0.6);
                border-radius: 12px;
                padding: 24px 32px;
                font-size: 38px;
                font-weight: 700;
                letter-spacing: 12px;
                color: #e2e8f0;
                border: 1px solid rgba(168,85,247,0.3);
                display: inline-block;
                font-family: monospace;
              " class="otp-code">
                ${otp}
              </div>
            </td>
          </tr>

          <!-- Info Text -->
          <tr>
            <td style="padding: 0 40px 32px; font-size: 15px; line-height: 1.6; color: #cbd5e1; text-align: center;">
              This code will <strong>expire in 10 minutes</strong> for security reasons.<br>
              <br>
              If you didn’t request this verification, you can safely ignore this email.
            </td>
          </tr>

          <!-- Button (optional fallback) -->
          <tr>
            <td align="center" style="padding: 0 0 48px;">
              <a href="localhost:5173/" style="
                display: inline-block;
                background: linear-gradient(90deg, #7c3aed, #a855f7);
                color: white;
                font-weight: 600;
                padding: 16px 48px;
                border-radius: 12px;
                text-decoration: none;
                font-size: 16px;
                box-shadow: 0 8px 20px rgba(168,85,247,0.25);
              ">
                Go to Website
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background: rgba(15,23,42,0.6); text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05);">
              © 2025 CONVOC - All rights reserved.<br>
              <a href="#" style="color: #a855f7; text-decoration: none;">Privacy Policy</a> • 
              <a href="#" style="color: #a855f7; text-decoration: none;">Unsubscribe</a>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    
    
    `
}

module.exports = emailTemplate;