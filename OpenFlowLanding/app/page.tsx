import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { LiveDemo } from "@/components/LiveDemo";
import { AiCoding } from "@/components/AiCoding";
import { Dictionary } from "@/components/Dictionary";
import { Privacy } from "@/components/Privacy";
import { Pricing } from "@/components/Pricing";
import { FAQ } from "@/components/FAQ";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { FloatingPill } from "@/components/FloatingPill";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
        <LiveDemo />
        <AiCoding />
        <Dictionary />
        <Privacy />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <FloatingPill />
    </>
  );
}
