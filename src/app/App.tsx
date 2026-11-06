import demoJson from "../generated/demo.json";
import type { DemoPayload } from "../shared/types";
import { useReplay } from "./useReplay";
import { Masthead, Footer } from "./components/Chrome";
import { Hero } from "./components/Hero";
import { RoomSection } from "./components/RoomSection";
import { BriefSheet } from "./components/BriefSheet";
import { Switchboard } from "./components/Switchboard";

const demo = demoJson as unknown as DemoPayload;

export default function App() {
  const replay = useReplay(demo.transcript.length);

  const play = () => {
    replay.restart();
    const room = document.getElementById("room");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    room?.focus({ preventScroll: true });
    room?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div id="top">
      <a className="skip" href="#room">
        Skip to the room
      </a>
      <Masthead onPlay={play} />
      <main>
        <Hero demo={demo} onPlay={play} />
        <RoomSection demo={demo} replay={replay} />
        <BriefSheet demo={demo} />
        <Switchboard demo={demo} />
      </main>
      <Footer demo={demo} />
    </div>
  );
}
