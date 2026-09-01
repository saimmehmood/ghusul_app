import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { whatsappIsConfigured } from "@/lib/whatsapp";
import { saveProfile } from "./actions";

const ERRORS: Record<string, string> = {
  name: "Please enter your name so people know who is coming.",
  phone:
    "To get WhatsApp messages we need your phone number, including the area code. Please add it, or untick WhatsApp.",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const returning = Boolean(user.name);
  const whatsappAvailable = whatsappIsConfigured();

  return (
    <div className="stack-lg">
      <div>
        <h1>{returning ? "Your details" : "Assalamu alaikum"}</h1>
        <p className="lede">
          {returning
            ? "Update your name, your phone number, and how you would like to hear about new days."
            : "Just one thing before you start — what name should we show on the schedule so others know who is coming?"}
        </p>
      </div>

      {error && ERRORS[error] && (
        <div className="notice notice-bad" role="alert">
          {ERRORS[error]}
        </div>
      )}

      <form action={saveProfile} className="stack">
        <div className="field">
          <label htmlFor="name">Your full name</label>
          <input
            id="name"
            name="name"
            type="text"
            className="input"
            autoComplete="name"
            autoCapitalize="words"
            required
            autoFocus={!returning}
            defaultValue={user.name}
            placeholder="Ahmed Khan"
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <p className="hint">
            Only the masjid administrator can see this. Needed if you want
            WhatsApp messages.
          </p>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="input"
            autoComplete="tel"
            inputMode="tel"
            defaultValue={user.phone}
            placeholder="555-123-4567"
          />
        </div>

        <fieldset
          style={{
            border: "2px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "18px 20px",
            margin: "8px 0 0",
            background: "var(--surface)",
          }}
        >
          <legend style={{ fontSize: 18, fontWeight: 700, padding: "0 8px" }}>
            Tell me when a new day is posted
          </legend>

          <label className="check">
            <input
              type="checkbox"
              name="notify_email"
              defaultChecked={user.notify_email}
            />
            <span>
              <strong>Email me</strong>
              <span className="check-hint">Sent to {user.email}</span>
            </span>
          </label>

          <label className="check">
            <input
              type="checkbox"
              name="notify_whatsapp"
              defaultChecked={user.notify_whatsapp}
              disabled={!whatsappAvailable}
            />
            <span>
              <strong>Message me on WhatsApp</strong>
              <span className="check-hint">
                {whatsappAvailable
                  ? "Sent to the phone number above."
                  : "Not switched on by the masjid yet."}
              </span>
            </span>
          </label>
        </fieldset>

        <SubmitButton className="btn btn-primary btn-block" pendingLabel="Saving…">
          {returning ? "Save changes" : "Continue to the schedule"}
        </SubmitButton>
      </form>
    </div>
  );
}
