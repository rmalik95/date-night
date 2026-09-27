"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import content from "@/content/public-date-night.json";

export default function MemoryLanePage() {
  const roleParam = useSearchParams().get("role");
  const role = roleParam === "host" || roleParam === "guest" ? roleParam : null;
  const backHref = role === "host" ? "/?host=rishabh-host-3years" : role === "guest" ? "/?guest=glyra-guest-3years" : "/";
  const returnToNight = () => { window.location.assign(backHref); };
  return (
    <main className="memory-lane-page">
      <div className="memory-lane-glow" />
      <header className="memory-lane-header">
        <button className="memory-lane-back" type="button" onClick={returnToNight}><ArrowLeft /> Back to our night</button>
        <span className="memory-lane-mark" aria-label="Glyra and Rishabh">G<span>&</span>R</span>
      </header>
      <section className="memory-lane-intro">
        <h1>Let’s take a walk down memory lane where it all started.</h1>
      </section>
      <div className="memory-lane-list" aria-label="Our memories">
        {content.memoryLane.map((memory) => (
          <section className="memory-lane-chapter" key={memory.title}>
            <h2>{memory.title}</h2>
            <div className={`memory-lane-photos photos-${Math.min(memory.photos.length, 4)}`}>
              {memory.photos.map((photo, index) => <Image key={photo} src={photo} alt={`${memory.title}, photo ${index + 1}`} width={1200} height={900} />)}
            </div>
          </section>
        ))}
      </div>
      <footer className="memory-lane-footer">
        <button className="memory-lane-return" type="button" onClick={returnToNight}>Back to our night <ArrowLeft /></button>
        <Link className="memory-lane-home" href="/"><Home /> Home</Link>
      </footer>
    </main>
  );
}
