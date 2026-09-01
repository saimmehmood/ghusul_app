import "server-only";

export type BlastResult = {
  sent: number;
  failed: number;
  detail: string;
};

export type WhatsAppRecipient = {
  phone_e164: string;
  name: string;
};

/**
 * Template parameters, in the order the approved template expects them.
 * Meta requires an approved template for any message sent outside a 24-hour
 * window; Twilio's sandbox accepts free text instead, which is why the
 * free-text form is carried alongside.
 */
export type Announcement = {
  freeText: string;
  templateParams: string[];
};

export type WhatsAppProvider = "none" | "twilio" | "meta";

export function whatsappProvider(): WhatsAppProvider {
  const configured = (process.env.WHATSAPP_PROVIDER || "none").toLowerCase();
  if (configured === "twilio") {
    return process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      ? "twilio"
      : "none";
  }
  if (configured === "meta") {
    return process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
      ? "meta"
      : "none";
  }
  return "none";
}

export function whatsappIsConfigured(): boolean {
  return whatsappProvider() !== "none";
}

/**
 * Sends to each recipient in turn. WhatsApp has no bulk endpoint — every
 * message is its own API call — so this is sequential on purpose, to stay
 * inside provider rate limits rather than trip them with a burst.
 */
export async function sendWhatsAppBlast(
  recipients: WhatsAppRecipient[],
  announcement: Announcement,
): Promise<BlastResult> {
  const provider = whatsappProvider();

  if (provider === "none") {
    return {
      sent: 0,
      failed: 0,
      detail: "WhatsApp is not configured; nothing was sent.",
    };
  }
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, detail: "Nobody has opted in to WhatsApp." };
  }

  let sent = 0;
  const errors: string[] = [];

  for (const person of recipients) {
    try {
      if (provider === "twilio") {
        await sendViaTwilio(person.phone_e164, announcement.freeText);
      } else {
        await sendViaMeta(person.phone_e164, announcement.templateParams);
      }
      sent += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${person.phone_e164}: ${reason}`);
    }
  }

  return {
    sent,
    failed: errors.length,
    detail: errors.slice(0, 5).join(" | "),
  };
}

async function sendViaTwilio(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
        To: `whatsapp:${to}`,
        Body: body,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(shorten(text) || `Twilio returned ${response.status}`);
  }
}

async function sendViaMeta(to: string, params: string[]): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const template = process.env.WHATSAPP_TEMPLATE_NAME || "ghusl_day_posted";
  const language = process.env.WHATSAPP_TEMPLATE_LANG || "en";

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        // Meta wants the number without the leading "+".
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: params.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(shorten(text) || `Meta returned ${response.status}`);
  }
}

function shorten(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}
