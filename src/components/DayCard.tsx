import type { DayView } from "@/lib/schedule";
import {
  formatServiceDate,
  formatWeekday,
  formatTime,
  humanDuration,
} from "@/lib/dates";
import { volunteerAction, cancelSignupAction } from "@/app/schedule/actions";
import { SubmitButton } from "./SubmitButton";

function StatusPill({ day }: { day: DayView }) {
  if (day.cancelled_at) {
    return <span className="pill pill-full">Cancelled</span>;
  }
  if (day.isPast) {
    return <span className="pill pill-full">Past</span>;
  }
  if (day.isFull) {
    return <span className="pill pill-full">✓ All spots filled</span>;
  }
  if (day.inPriorityWindow) {
    return <span className="pill pill-priority">★ New volunteers first</span>;
  }
  return (
    <span className="pill pill-open">
      {day.spotsLeft} {day.spotsLeft === 1 ? "spot" : "spots"} left
    </span>
  );
}

/**
 * The priority-window explainer. Written differently depending on whether the
 * reader can actually act on it, so nobody has to work out what it means for
 * them personally.
 */
function PriorityNotice({ day }: { day: DayView }) {
  if (!day.inPriorityWindow || day.isPast || day.isFull || day.cancelled_at) {
    return null;
  }

  const opensAt = formatTime(day.priorityEndsAt);
  const remaining = humanDuration(day.priorityEndsAt.getTime() - Date.now());

  if (day.viewerSignedUp) {
    return (
      <div className="notice notice-info">
        Until <strong>{opensAt}</strong>, remaining spots are saved for people
        who have not done Ghusl yet this month. After that, anyone may join.
      </div>
    );
  }

  if (day.viewerIsNewThisMonth) {
    return (
      <div className="notice notice-info">
        <strong>You have first choice on this day.</strong> You have not done
        Ghusl yet this month, so you can sign up now. In {remaining} — at{" "}
        {opensAt} — this day opens to everyone.
      </div>
    );
  }

  return (
    <div className="notice notice-info">
      This day is being offered first to people who have not done Ghusl yet this
      month. You have already volunteered this month, so please check back at{" "}
      <strong>{opensAt}</strong> — {remaining} from now — when it opens to
      everyone.
    </div>
  );
}

function Roster({ day, viewerId }: { day: DayView; viewerId: string | null }) {
  const openSpots = Array.from({ length: day.spotsLeft });

  return (
    <ul className="roster">
      {day.volunteers.map((v) => (
        <li key={v.user_id}>
          <span className="tick" aria-hidden="true">
            ✓
          </span>
          <span className="who">{v.name || v.email}</span>
          {v.user_id === viewerId && <span className="you">You</span>}
        </li>
      ))}

      {openSpots.map((_, i) => (
        <li key={`open-${i}`} className="is-empty">
          <span className="dash" aria-hidden="true">
            —
          </span>
          <span>Open spot</span>
        </li>
      ))}
    </ul>
  );
}

export function DayCard({
  day,
  viewerId,
  backTo = "/schedule",
}: {
  day: DayView;
  viewerId: string | null;
  backTo?: string;
}) {
  const classes = [
    "card",
    day.viewerSignedUp ? "is-mine" : "",
    day.isPast || day.cancelled_at ? "is-past" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes}>
      <div className="card-head">
        <div>
          <p className="day-weekday">{formatWeekday(day.service_date)}</p>
          <h2 className="day-date">{formatServiceDate(day.service_date)}</h2>
        </div>
        <StatusPill day={day} />
      </div>

      {day.note && <p className="lede" style={{ marginTop: 12 }}>{day.note}</p>}

      <div style={{ marginTop: 16 }}>
        <PriorityNotice day={day} />
      </div>

      <Roster day={day} viewerId={viewerId} />

      {day.viewerSignedUp && !day.isPast && (
        <>
          <div className="notice notice-good" style={{ marginTop: 18 }}>
            <strong>You are signed up for this day.</strong> Jazak Allahu
            khairan. Please arrive on time.
          </div>
          <form action={cancelSignupAction} className="btn-row">
            <input type="hidden" name="dayId" value={day.id} />
            <input type="hidden" name="back" value={backTo} />
            <SubmitButton className="btn btn-danger" pendingLabel="Removing…">
              I can no longer make it
            </SubmitButton>
          </form>
        </>
      )}

      {day.viewerCanSignUp && (
        <form action={volunteerAction} className="btn-row">
          <input type="hidden" name="dayId" value={day.id} />
          <input type="hidden" name="back" value={backTo} />
          <SubmitButton
            className="btn btn-primary btn-block"
            pendingLabel="Signing you up…"
          >
            Volunteer for this day
          </SubmitButton>
        </form>
      )}

      {!day.viewerSignedUp &&
        !day.viewerCanSignUp &&
        day.viewerBlockedReason &&
        !day.inPriorityWindow && (
          <p className="muted small" style={{ marginTop: 16 }}>
            {day.viewerBlockedReason}
          </p>
        )}
    </article>
  );
}
