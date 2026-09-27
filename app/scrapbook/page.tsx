import Link from "next/link";
import { ArrowLeft, Camera, Heart, Sparkles } from "lucide-react";
import content from "@/content/public-date-night.json";

export default function ScrapbookPage({ searchParams }: { searchParams?: { role?: string } }) {
  const role = searchParams?.role === "host" || searchParams?.role === "guest" ? searchParams.role : null;
  const backHref = role ? `/${role}` : "/";
  return (
    <main className="scrapbook-page">
      <div className="scrapbook-glow" />
      <header className="scrapbook-header">
        <Link className="scrapbook-back" href={backHref}>
          <ArrowLeft /> Back to our night
        </Link>
        <span className="scrapbook-mark" aria-label="Glyra and Rishabh">G<span>&</span>R</span>
      </header>
      <section className="scrapbook-intro">
        <p className="scrapbook-kicker"><Sparkles /> Our little archive</p>
        <h1>Every mile led back to us.</h1>
        <p>
          From tiny squares on FaceTime to every long-awaited arrival, here’s
          the story we’re still writing.
        </p>
      </section>
      <section className="scrapbook-timeline" aria-label="Our story so far">
        {content.scrapbook.map((memory, index) => (
          <article className={`scrapbook-entry ${memory.tone}`} key={memory.title}>
            <div className="scrapbook-date"><span>{String(index + 1).padStart(2, "0")}</span>{memory.date}</div>
            <div className="scrapbook-photo" role="img" aria-label={memory.label}>
              <Camera />
              <strong>{memory.label}</strong>
              <small>Replace this placeholder with your photo</small>
            </div>
            <div className="scrapbook-copy">
              <Heart />
              <h2>{memory.title}</h2>
              <p>{memory.caption}</p>
            </div>
          </article>
        ))}
      </section>
      <footer className="scrapbook-footer">
        <Heart /> <span>Three years down. A lifetime of pages to fill.</span>
      </footer>
    </main>
  );
}
