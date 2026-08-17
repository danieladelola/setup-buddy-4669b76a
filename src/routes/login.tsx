import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { api, setToken } from "@/lib/api";
import heroImage from "@/assets/hero-network.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — HSENations Mail" },
      { name: "description", content: "Private admin sign in for the HSENations Mail campaign platform." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setToken(res.token);
      navigate({ to: "/admin" });
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2 bg-background text-foreground">
      {/* Left: branded visual */}
      <aside
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between p-12"
        style={{ background: "var(--gradient-surface)" }}
      >
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-screen"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-24 h-[26rem] w-[26rem] rounded-full blur-3xl opacity-40"
          style={{ background: "var(--gradient-brand)" }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl font-mono text-sm font-bold text-primary-foreground shadow-[0_0_30px_rgba(124,92,255,0.45)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            H
          </div>
          <div className="font-mono text-sm tracking-[0.18em] text-foreground/80">
            HSE/MAIL
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-primary/80">
            // Campaign Control
          </p>
          <h2 className="mt-4 font-mono text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            Send with
            <span
              className="block bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              precision.
            </span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
            A private cockpit for HSENations email campaigns — AWS SES delivery,
            real-time tracking, and clean reports. Built for one operator. Built
            to ship.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-border/60 pt-6">
            {[
              { k: "DELIVERY", v: "SES" },
              { k: "TRACKING", v: "LIVE" },
              { k: "ACCESS", v: "ADMIN" },
            ].map((s) => (
              <div key={s.k}>
                <dt className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground">
                  {s.k}
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-foreground">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative z-10 font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground">
          © {new Date().getFullYear()} HSENATIONS · INTERNAL
        </div>
      </aside>

      {/* Right: form */}
      <section className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <div
                className="grid h-9 w-9 place-items-center rounded-lg font-mono text-sm font-bold text-primary-foreground"
                style={{ background: "var(--gradient-brand)" }}
              >
                H
              </div>
              <span className="font-mono text-sm tracking-[0.18em]">HSE/MAIL</span>
            </div>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Home
            </Link>
          </div>

          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary">
            // Admin Access
          </p>
          <h1 className="mt-3 font-mono text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sign in to your console
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your admin credentials to continue. Sessions are private and
            time-bound.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="admin@hsenations.com"
                className="w-full rounded-lg border border-border bg-input/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-border bg-input/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-lg px-4 py-3 font-mono text-sm font-semibold tracking-wide text-primary-foreground transition disabled:opacity-60"
              style={{
                background: "var(--gradient-brand)",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              <span className="relative z-10">
                {loading ? "AUTHENTICATING…" : "SIGN IN →"}
              </span>
            </button>

            <p className="pt-2 text-center font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              Authorized personnel only
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
