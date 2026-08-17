import { createFileRoute, Link } from "@tanstack/react-router";
import heroImage from "@/assets/hero-network.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HSENations Mail — Private Email Campaign Platform" },
      {
        name: "description",
        content:
          "HSENations Mail is the private email campaign console for HSENations — AWS SES delivery, real-time tracking, and clean reports. Admin access only.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "HSENations Mail" },
      {
        property: "og:description",
        content: "Private email campaign console — admin access only.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="relative z-20 border-b border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-lg font-mono text-sm font-bold text-primary-foreground shadow-[0_0_24px_rgba(124,92,255,0.45)]"
              style={{ background: "var(--gradient-brand)" }}
            >
              H
            </div>
            <span className="font-mono text-sm tracking-[0.18em]">HSE/MAIL</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/admin"
              className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-primary-foreground transition"
              style={{
                background: "var(--gradient-brand)",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              Console →
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — split */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-20 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-30"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-10rem] top-[-6rem] h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30"
          style={{ background: "var(--gradient-brand)" }}
        />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="relative z-10">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-primary">
              // Private · Internal · v1
            </p>
            <h1 className="mt-5 font-mono text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              The campaign
              <span
                className="block bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                control room.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              HSENations Mail is the in-house console for our email lists.
              Compose, send, track, and report — powered by AWS SES, secured
              behind admin auth, and tuned for one operator.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="rounded-lg px-6 py-3 font-mono text-sm font-semibold tracking-wide text-primary-foreground transition"
                style={{
                  background: "var(--gradient-brand)",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                Sign in →
              </Link>
              <Link
                to="/admin"
                className="rounded-lg border border-border bg-card/50 px-6 py-3 font-mono text-sm font-semibold text-foreground backdrop-blur transition hover:border-primary/60 hover:bg-card"
              >
                Open console
              </Link>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-border/60 pt-6">
              {[
                { k: "Delivery", v: "AWS SES" },
                { k: "Webhooks", v: "AWS SNS" },
                { k: "Database", v: "Postgres" },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                    {s.k}
                  </dt>
                  <dd className="mt-1 font-mono text-base font-semibold text-foreground">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Visual */}
          <div className="relative">
            <div
              className="relative overflow-hidden rounded-2xl border border-border/60"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <img
                src={heroImage}
                alt="Global email delivery network visualization"
                width={1080}
                height={1920}
                className="h-[36rem] w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 40%, oklch(0.14 0.04 280 / 0.9) 100%)",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="rounded-xl border border-border/60 bg-card/70 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                        Last campaign
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                        October Newsletter · Sent
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary">
                        Live
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    {[
                      { k: "Sent", v: "12,480" },
                      { k: "Open", v: "41.2%" },
                      { k: "Click", v: "8.7%" },
                    ].map((s) => (
                      <div key={s.k} className="rounded-lg bg-background/60 py-2">
                        <p className="font-mono text-base font-bold text-foreground">
                          {s.v}
                        </p>
                        <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                          {s.k}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
            © {new Date().getFullYear()} HSENations · Internal Tool
          </p>
          <a
            href="tel:+2348036979392"
            className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-primary"
          >
            +234 803 697 9392
          </a>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
            mail.hsenations.com
          </p>
        </div>
      </footer>
    </main>
  );
}
