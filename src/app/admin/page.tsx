import { requireAdmin } from "@/lib/auth";
import { getAllDays } from "@/lib/schedule";
import { sql } from "@/lib/db";
import {
  formatServiceDate,
  formatDateTime,
  formatTime,
  formatMonthName,
  todayInTimezone,
} from "@/lib/dates";
import { APP_TIMEZONE } from "@/lib/config";
import { SubmitButton } from "@/components/SubmitButton";
import { ShareRow } from "@/components/ShareRow";
import { composeAnnouncement, whatsappShareLink } from "@/lib/notify";
import { whatsappProvider } from "@/lib/whatsapp";
import {
  postDayAction,
  cancelDayAction,
  restoreDayAction,
  repostDayAction,
  removeVolunteerAction,
  announceDayAction,
} from "./actions";

const MESSAGES: Record<string, string> = {
  posted: "The day is posted. The 4-hour priority window has started now.",
  cancelled: "That day has been cancelled and removed from the schedule.",
  restored: "That day is back on the schedule.",
  reposted: "The priority window has been restarted from now.",
  removed: "That volunteer has been taken off the day.",
  "bad-date": "Please pick a valid date.",
  "announce-missing": "That day could not be found, so nothing was sent.",
};

/**
 * Turns the counts an announcement action passes back into a sentence, so the
 * admin sees what was actually delivered instead of a bare "sent".
 */
function deliveryLine(params: {
  e?: string;
  ef?: string;
  w?: string;
  wf?: string;
}): string | null {
  const emailSent = Number(params.e ?? NaN);
  const emailFailed = Number(params.ef ?? 0);
  const waSent = Number(params.w ?? NaN);
  const waFailed = Number(params.wf ?? 0);
  if (Number.isNaN(emailSent) && Number.isNaN(waSent)) return null;

  const parts: string[] = [];
  if (!Number.isNaN(emailSent)) {
    parts.push(
      emailSent > 0
        ? `emailed ${emailSent} ${emailSent === 1 ? "person" : "people"}`
        : "no emails sent",
    );
  }
  if (!Number.isNaN(waSent) && waSent > 0) {
    parts.push(`messaged ${waSent} on WhatsApp`);
  }
  const failures = emailFailed + waFailed;
  const tail = failures > 0 ? ` (${failures} could not be delivered)` : "";
  return parts.join(", ") + tail + ".";
}

type Participant = { name: string; email: string; total: number };

/**
 * Who has volunteered, grouped by the month the Ghusl actually falls in — the
 * same month the priority rule uses. Grouping by the service date rather than
 * the current calendar month matters: days for next month are usually posted
 * before that month begins.
 */
async function participationByMonth(): Promise<
  { monthKey: string; people: Participant[] }[]
> {
  const rows = (await sql`
    select to_char(d.service_date, 'YYYY-MM') as month_key,
           u.name,
           u.email,
           count(*)::int as total
      from signups s
      join ghusl_days d on d.id = s.day_id
      join users u      on u.id = s.user_id
     where d.cancelled_at is null
     group by 1, u.id, u.name, u.email
     order by 1 desc, total desc, u.name asc
  `) as (Participant & { month_key: string })[];

  const months: { monthKey: string; people: Participant[] }[] = [];
  for (const row of rows) {
    let bucket = months.find((m) => m.monthKey === row.month_key);
    if (!bucket) {
      bucket = { monthKey: row.month_key, people: [] };
      months.push(bucket);
    }
    bucket.people.push({
      name: row.name,
      email: row.email,
      total: row.total,
    });
  }
  return months.slice(0, 3);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    msg?: string;
    e?: string;
    ef?: string;
    w?: string;
    wf?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const { msg, ...counts } = await searchParams;
  const delivery = deliveryLine(counts);
  const provider = whatsappProvider();

  const [days, participation] = await Promise.all([
    getAllDays(admin),
    participationByMonth(),
  ]);

  const today = todayInTimezone();

  return (
    <div className="stack-lg">
      <div>
        <h1>Admin</h1>
        <p className="lede">
          Post the dates that need Ghusl volunteers. Times shown in{" "}
          {APP_TIMEZONE.replace("_", " ")}.
        </p>
      </div>

      {msg && MESSAGES[msg] && (
        <div
          className={`notice ${
            msg === "bad-date" || msg === "announce-missing"
              ? "notice-bad"
              : "notice-good"
          }`}
          role="status"
        >
          {MESSAGES[msg]}
        </div>
      )}

      {(msg === "announced" || msg === "posted-announced") && (
        <div className="notice notice-good" role="status">
          {msg === "posted-announced" && (
            <>
              <strong>The day is posted.</strong>{" "}
            </>
          )}
          {delivery ?? "The announcement was sent."}{" "}
          {provider === "none" && (
            <>
              WhatsApp is not switched on, so use the{" "}
              <strong>Share to WhatsApp</strong> button below to post it to your
              group.
            </>
          )}
        </div>
      )}

      <section className="card">
        <h2>Post a new day</h2>
        <p className="muted small" style={{ margin: "4px 0 18px" }}>
          The priority window starts the moment you post. For the first 4 hours
          only people who have not done Ghusl this month can sign up.
        </p>

        <form action={postDayAction} className="stack">
          <div className="field">
            <label htmlFor="service_date">Date Ghusl is needed</label>
            <input
              id="service_date"
              name="service_date"
              type="date"
              className="input"
              required
              defaultValue={today}
            />
          </div>

          <div className="field">
            <label htmlFor="slots_needed">How many volunteers are needed?</label>
            <select
              id="slots_needed"
              name="slots_needed"
              className="input"
              defaultValue="3"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "volunteer" : "volunteers"}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="priority_hours">Priority window</label>
            <p className="hint">
              How long the day stays reserved for people who have not helped
              this month.
            </p>
            <select
              id="priority_hours"
              name="priority_hours"
              className="input"
              defaultValue="4"
            >
              <option value="0">No priority window — open to all now</option>
              <option value="2">2 hours</option>
              <option value="4">4 hours (normal)</option>
              <option value="8">8 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="note">Note for volunteers</label>
            <p className="hint">
              Optional. For example the time, or which funeral home.
            </p>
            <input
              id="note"
              name="note"
              type="text"
              className="input"
              maxLength={300}
              placeholder="After Dhuhr, at the masjid"
            />
          </div>

          <label className="check">
            <input type="checkbox" name="announce" defaultChecked />
            <span>
              <strong>Tell everyone straight away</strong>
              <span className="check-hint">
                Emails everyone who has asked to be told
                {provider === "none"
                  ? ". You can share to WhatsApp with one tap afterwards."
                  : ", and sends a WhatsApp message to those who opted in."}
              </span>
            </span>
          </label>

          <SubmitButton className="btn btn-primary btn-block" pendingLabel="Posting…">
            Post this day
          </SubmitButton>
        </form>
      </section>

      <section className="card">
        <h2>Who has volunteered</h2>
        <p className="muted small" style={{ margin: "4px 0 18px" }}>
          Counted by the month the Ghusl falls in — the same month the priority
          rule uses.
        </p>

        {participation.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Nobody has signed up yet.
          </p>
        ) : (
          participation.map((month) => (
            <div key={month.monthKey} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, margin: "0 0 8px" }}>
                {formatMonthName(`${month.monthKey}-01`)}
              </h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Times</th>
                    </tr>
                  </thead>
                  <tbody>
                    {month.people.map((p) => (
                      <tr key={p.email}>
                        <td>{p.name || "—"}</td>
                        <td>{p.email}</td>
                        <td>{p.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="stack">
        <h2>All posted days</h2>

        {days.length === 0 && (
          <div className="empty">
            <p>No days posted yet.</p>
          </div>
        )}

        {days.map((day) => (
          <article
            key={day.id}
            className={`card ${day.isPast || day.cancelled_at ? "is-past" : ""}`}
          >
            <div className="card-head">
              <div>
                <h2 className="day-date">
                  {formatServiceDate(day.service_date)}
                </h2>
                <p className="day-weekday">
                  {day.filled} of {day.slots_needed} filled · posted{" "}
                  {formatDateTime(day.posted_at)}
                </p>
              </div>
              {day.cancelled_at ? (
                <span className="pill pill-full">Cancelled</span>
              ) : day.inPriorityWindow ? (
                <span className="pill pill-priority">
                  ★ Priority until {formatTime(day.priorityEndsAt)}
                </span>
              ) : day.isFull ? (
                <span className="pill pill-full">✓ Full</span>
              ) : day.isPast ? (
                <span className="pill pill-full">Past</span>
              ) : (
                <span className="pill pill-open">
                  {day.spotsLeft} left · open to all
                </span>
              )}
            </div>

            {day.note && (
              <p className="lede" style={{ marginTop: 12 }}>
                {day.note}
              </p>
            )}

            {day.volunteers.length > 0 && (
              <ul className="roster">
                {day.volunteers.map((v) => (
                  <li key={v.user_id}>
                    <span className="tick" aria-hidden="true">
                      ✓
                    </span>
                    <span className="who">{v.name || "—"}</span>
                    <span className="muted small">
                      {v.phone ? `${v.phone} · ` : ""}
                      {v.email}
                    </span>
                    <span className="spacer" />
                    <form action={removeVolunteerAction}>
                      <input type="hidden" name="dayId" value={day.id} />
                      <input type="hidden" name="userId" value={v.user_id} />
                      <SubmitButton
                        className="btn btn-danger"
                        pendingLabel="Removing…"
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            {!day.cancelled_at && !day.isPast && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 18,
                  borderTop: "2px solid var(--border)",
                }}
              >
                <p
                  className="small"
                  style={{ margin: "0 0 4px", fontWeight: 700 }}
                >
                  Tell people about this day
                </p>
                <p className="muted small" style={{ margin: "0 0 4px" }}>
                  {day.notified_at
                    ? `Last sent ${formatDateTime(day.notified_at)}.`
                    : "Not announced yet."}
                </p>

                <ShareRow
                  shareLink={whatsappShareLink(day)}
                  message={composeAnnouncement(day).whatsappText}
                />

                <form action={announceDayAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="dayId" value={day.id} />
                  <SubmitButton
                    className="btn btn-quiet"
                    pendingLabel="Sending…"
                  >
                    {day.notified_at
                      ? "Send a reminder"
                      : provider === "none"
                        ? "Email everyone"
                        : "Email + WhatsApp everyone"}
                  </SubmitButton>
                </form>
              </div>
            )}

            <div className="btn-row">
              {day.cancelled_at ? (
                <form action={restoreDayAction}>
                  <input type="hidden" name="dayId" value={day.id} />
                  <SubmitButton className="btn btn-quiet" pendingLabel="Restoring…">
                    Put back on schedule
                  </SubmitButton>
                </form>
              ) : (
                <>
                  {!day.isPast && (
                    <form action={repostDayAction}>
                      <input type="hidden" name="dayId" value={day.id} />
                      <SubmitButton
                        className="btn btn-quiet"
                        pendingLabel="Restarting…"
                      >
                        Restart priority window
                      </SubmitButton>
                    </form>
                  )}
                  <form action={cancelDayAction}>
                    <input type="hidden" name="dayId" value={day.id} />
                    <SubmitButton
                      className="btn btn-danger"
                      pendingLabel="Cancelling…"
                    >
                      Cancel this day
                    </SubmitButton>
                  </form>
                </>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
