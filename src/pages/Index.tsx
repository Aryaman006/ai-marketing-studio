import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Zap, Loader2, Sparkles, Globe, FileText, Image, BookOpen,
  BarChart3, Palette, MousePointerClick, ArrowRight, CheckCircle2,
  Star, Shield, Rocket, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: FileText,
    title: "AI Social Posts",
    description: "Generate on-brand social media content in seconds with customizable tone and style.",
  },
  {
    icon: Globe,
    title: "Landing Pages",
    description: "Create stunning, responsive landing pages with AI — then edit visually or with code.",
  },
  {
    icon: Image,
    title: "Marketing Assets",
    description: "Design banners, ads, logos, and SVGs powered by AI image generation and stock photos.",
  },
  {
    icon: BookOpen,
    title: "Blog Engine",
    description: "Generate SEO-optimized blog posts, publish to your own branded blog site instantly.",
  },
  {
    icon: BarChart3,
    title: "Built-in Analytics",
    description: "Track views, clicks, CTAs, and referrers across all your content — zero setup.",
  },
  {
    icon: Palette,
    title: "Brand Campaigns",
    description: "Set your brand voice, colors, and audience once — every generation stays consistent.",
  },
];

const TESTIMONIALS = [
  {
    name: "Sarah K.",
    role: "Founder, GrowthLab",
    quote: "Replaced 4 different tools. Our content velocity 3x'd in the first week.",
    avatar: "S",
  },
  {
    name: "James T.",
    role: "Marketing Lead, Nexus",
    quote: "The landing page builder alone is worth it. We ship campaigns in hours, not days.",
    avatar: "J",
  },
  {
    name: "Priya M.",
    role: "Solo Creator",
    quote: "As a one-person team, this is my unfair advantage. Posts, pages, assets — all in one place.",
    avatar: "P",
  },
];

const STATS = [
  { label: "Content Pieces Generated", value: "50K+" },
  { label: "Active Campaigns", value: "2,400+" },
  { label: "Landing Pages Live", value: "8,000+" },
  { label: "Avg. Time Saved / Week", value: "12hrs" },
];

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-glow">
              <Zap className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Marketing OS</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground hidden sm:inline-flex" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
              Features
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hidden sm:inline-flex" onClick={() => document.getElementById("testimonials")?.scrollIntoView({ behavior: "smooth" })}>
              Testimonials
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")} size="sm" className="gradient-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Get Started Free
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 text-primary bg-primary/5 px-4 py-1.5 text-xs font-medium">
            <Rocket className="h-3 w-3 mr-1.5" />
            AI-Powered Marketing Platform
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Ship marketing content{" "}
            <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              10x faster
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10">
            Generate social posts, landing pages, blog articles, and marketing assets — all on-brand, 
            all from one platform. Set your campaign once, create everywhere.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="w-full sm:w-auto gap-2.5 gradient-primary text-primary-foreground hover:opacity-90 transition-opacity px-8 h-12 text-base shadow-glow"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Start Free with Google
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-12 text-base border-border/50 hover:bg-secondary/50"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              See How It Works <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />Free to start</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />No credit card</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />50 free credits</span>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 border-primary/20 text-primary text-xs">
            <Sparkles className="h-3 w-3 mr-1" />Features
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything your marketing team needs
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            One platform to generate, edit, publish, and track all your marketing content — powered by AI, guided by your brand.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="glass group hover:shadow-glow hover:border-primary/20 transition-all duration-300">
              <CardContent className="p-6">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="bg-card/30 border-y border-border/50">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Three steps to marketing velocity
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              From brand setup to published content in minutes, not weeks.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { step: "01", title: "Create a Campaign", desc: "Define your brand voice, colors, audience, and upload a logo. This becomes the DNA of all generated content.", icon: Palette },
              { step: "02", title: "Generate Content", desc: "Use AI to create social posts, landing pages, blog articles, and visual assets — all on-brand, instantly.", icon: Sparkles },
              { step: "03", title: "Publish & Track", desc: "Go live with one click. Track views, clicks, CTAs, and traffic sources with built-in analytics.", icon: BarChart3 },
            ].map((s) => (
              <div key={s.step} className="relative text-center group">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow mb-5 group-hover:animate-pulse-glow transition-shadow">
                  <s.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="text-xs font-bold text-primary/60 mb-2">{s.step}</div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="testimonials" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 border-primary/20 text-primary text-xs">
            <Users className="h-3 w-3 mr-1" />Loved by Marketers
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Trusted by growing teams
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="glass hover:shadow-glow transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5 italic">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 py-20 sm:py-28 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to ship content faster?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join thousands of marketers and founders who generate professional content in minutes. Start free — no credit card required.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="gap-2.5 gradient-primary text-primary-foreground hover:opacity-90 transition-opacity px-10 h-12 text-base shadow-glow"
          >
            <Zap className="h-5 w-5" />
            Get Started Free
          </Button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/50 bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">Marketing OS</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" />SOC 2 Compliant</span>
            <span>© {new Date().getFullYear()} Marketing OS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
