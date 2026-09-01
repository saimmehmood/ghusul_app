import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getMyDays } from "@/lib/schedule";
import { DayCard } from "@/components/DayCard";
import { todayInTimezone } from "@/lib/dates";

export default async function MyDaysPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requireUser();
  if (!user.name) redirect("/welcome");

  const { msg } = await searchParams;
  const days = await getMyDays(user);
  const today = todayInTimezone();

  const upcoming = days.filter((d) => d.service_date >= today);
  const past = days.filter((d) => d.service_date < today).reverse();

  return (
    <div className="stack-lg">
      <div>
        <h1>My days</h1>
        <p className="lede">
          {upcoming.length === 0
            ? "You are not signed up for any upcoming days."
            : `You are signed up for ${upcoming.length} upcoming ${
                upcoming.length === 1 ? "day" : "days"
              }.`}
        </p>
      </div>

      {msg === "cancelled" && (
        <div className="notice notice-info" role="status">
          You have been taken off that day.
        </div>
      )}

      {upcoming.length === 0 ? (
        <div className="empty">
          <p>Nothing coming up.</p>
          <p className="small">
            Go to the schedule to find a day you can help with.
          </p>
        </div>
      ) : (
        <div className="stack">
          {upcoming.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              viewerId={user.id}
              backTo="/mine"
            />
          ))}
        </div>
      )}

      <Link href="/schedule" className="btn btn-quiet btn-block">
        See all days needing volunteers
      </Link>

      {past.length > 0 && (
        <div className="stack">
          <h2>Days you have helped with</h2>
          {past.slice(0, 12).map((day) => (
            <DayCard key={day.id} day={day} viewerId={user.id} backTo="/mine" />
          ))}
        </div>
      )}

      <div className="foot">
        <Link href="/welcome">Change my name or phone number</Link>
      </div>
    </div>
  );
}
