import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({});
const TO_EMAIL = process.env.TO_EMAIL || "berriostreesvc@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "Berrios Tree Service <estimates@berriostreeservice.com>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function response(status, body) {
  return { statusCode: status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function turnstileOk(token) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token) return false;
  const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const result = await verify.json();
  return result.success === true;
}

export async function handler(event) {
  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    if (!(await turnstileOk(text(payload.turnstileToken, 2048)))) {
      return response(403, { error: "Verification failed. Please refresh the page and try again." });
    }

    const name = text(payload.name, 120);
    const email = text(payload.email, 254);
    const phone = text(payload.phone, 40);
    const description = text(payload.description, 5000);
    if (!name || !phone || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response(400, { error: "Please provide your name, phone, and a valid email address." });
    }

    const lines = [
      ["Name", name],
      ["Email", email],
      ["Phone", phone],
      ["Description", description || "—"],
    ];

    await ses.send(new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination: { ToAddresses: [TO_EMAIL] },
      ReplyToAddresses: [email],
      Content: {
        Simple: {
          Subject: { Data: `New estimate request from ${name}`, Charset: "UTF-8" },
          Body: {
            Text: { Data: lines.map(([label, value]) => `${label}: ${value}`).join("\n"), Charset: "UTF-8" },
            Html: {
              Data: lines.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join(""),
              Charset: "UTF-8",
            },
          },
        },
      },
    }));

    return response(200, { ok: true });
  } catch (error) {
    console.error(error);
    return response(502, { error: "We couldn't send your request. Please call (210) 409-0076 or try again." });
  }
}
