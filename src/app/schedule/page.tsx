import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getUpcomingDays } from "@/lib/schedule";
import { DayCard } from "@/components/DayCard";

const MESSAGES: Record<string, { tone: string; text: string }> = {
  "signed-up": {
    tone: "notice-good",
    text: "You are signed up. Jazak Allahu khairan — we have added you to that day.",
  },
  cancelled: {
    tone: "notice-info",
    text: "You have been taken off that day. Your spot is open for someone else.",
  },
  "could-not-sign-up": {
    tone: "notice-bad",
    text: "Sorry — we could not add you to that day. It may have just filled up, or it is not open to you yet. Please look at the day below for details.",
  },
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requireUser();
  if (!user.name) redirect("/welcome");

  const { msg } = await searchParams;
  const notice = msg ? MESSAGES[msg] : null;

  const days = await getUpcomingDays(user);
  const openToMe = days.filter((d) => d.viewerCanSignUp).length;
  const mine = days.filter((d) => d.viewerSignedUp).length;

  return (
    <div className="stack-lg">
      <div>
        <h1>Days needing volunteers</h1>
        <p className="lede">
          {days.length === 0
            ? "Nothing is scheduled right now."
            : mine > 0
              ? `You are signed up for ${mine} upcoming ${mine === 1 ? "day" : "days"}.` +
                (openToMe > 0
                  ? ` ${openToMe} more ${openToMe === 1 ? "day is" : "days are"} open to you.`
                  : "")
              : openToMe > 0
                ? `${openToMe} ${openToMe === 1 ? "day is" : "days are"} open for you to sign up.`
                : "Nothing is open to you at the moment."}
        </p>
      </div>

      {notice && (
        <div className={`notice ${notice.tone}`} role="status">
          {notice.text}
        </div>
      )}

      {days.length === 0 ? (
        <div className="empty">
          <p>No days are posted yet.</p>
          <p className="small">
            When the masjid needs volunteers, the dates will appear here. Please
            check back.
          </p>
        </div>
      ) : (
        <div className="stack">
          {days.map((day) => (
            <DayCard key={day.id} day={day} viewerId={user.id} />
          ))}
        </div>
      )}

      <div className="helpbox">
        <h2>Why can I not sign up for some days?</h2>
        <ol>
          <li>
            When a new day is posted, the first <strong>4 hours</strong> are
            saved for people who have not done Ghusl yet that month, so everyone
            gets a turn.
          </li>
          <li>
            After 4 hours, the day opens to <strong>everyone</strong>, even if
            you have already volunteered this month.
          </li>
          <li>Each day shows the exact time it opens to everyone.</li>
        </ol>
      </div>
    </div>
  );
}
