"use client";
import { useState } from "react";

export default function NextRead() {
  const [view, setView] = useState("find"); 
  const [likedBooks, setLikedBooks] = useState("");
  const [dislikedBooks, setDislikedBooks] = useState("");
  const [mood, setMood] = useState("");
  const [matters, setMatters] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const moods = [{n:"Mind-bending",e:"🧠"}, {n:"Emotional",e:"😢"}, {n:"Dark",e:"😱"}, {n:"Romantic",e:"💕"}, {n:"Fun",e:"😂"}, {n:"Mystery",e:"🕵️"}, {n:"Cozy",e:"🫶"}, {n:"Fast-paced",e:"⚡"}];
  const priorities = ["Plot twists", "Characters", "Fast pacing", "Atmosphere", "Mystery", "Writing style", "Emotional impact"];
  const avoids = ["Slow burn", "Romance", "Horror", "Gore", "Fantasy", "Sad ending", "Too long", "Nothing"];

  const toggleMatter = (p: string) => {
    if (matters.includes(p)) setMatters(matters.filter(i => i !== p));
    else if (matters.length < 2) setMatters([...matters, p]);
  };

  const toggleAvoid = (a: string) => {
    if (a === "Nothing") setAvoid(["Nothing"]);
    else setAvoid(avoid.filter(i => i !== "Nothing").includes(a) ? avoid.filter(i => i !== a) : [...avoid.filter(i => i !== "Nothing"), a]);
  };

  // --- THE STABLE AI LOGIC ---
  const getRec = async () => {
    setLoading(true);
    setResult(null); 
    try {
      const prompt = `Suggest ONE real book for: Likes ${likedBooks}, Hates ${dislikedBooks}, Mood ${mood}. Respond ONLY JSON: {"title":"...","author":"...","reason":"..."}`;

      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_AI_KEY}` 
        },
        body: JSON.stringify({
          model: "llama3-8b-8192", // ตัวนี้คือตัวที่เสถียรที่สุดในโลกของ Groq ครับ
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Connection Error");
      
      const text = data.choices[0].message.content;
      setResult(JSON.parse(text));
    } catch (error: any) {
      alert("AI is sleepy: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black p-6 font-sans">
      <nav className="max-w-2xl mx-auto flex justify-between border-b-4 border-black pb-4 mb-10">
        <h1 className="text-2xl font-black italic uppercase">NextChapter v4</h1>
        <span className="text-[10px] font-bold">STABLE VERSION</span>
      </nav>

      <div className="max-w-xl mx-auto space-y-10">
        <h2 className="text-4xl font-black uppercase italic leading-none">Find Your Match</h2>
        
        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">Step 1: History</h3>
          <input className="w-full p-4 border-4 border-black rounded-2xl outline-none text-black" placeholder="Books you liked..." onChange={e=>setLikedBooks(e.target.value)} />
          <input className="w-full p-4 border-4 border-black rounded-2xl outline-none text-black" placeholder="Books you hated..." onChange={e=>setDislikedBooks(e.target.value)} />
        </section>

        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">Step 2: Mood</h3>
          <div className="flex flex-wrap gap-2">
            {moods.map(m => (
              <button key={m.n} onClick={() => setMood(m.n)} className={`px-4 py-3 rounded-xl border-2 font-bold text-sm ${mood === m.n ? "bg-black text-white border-black" : "bg-white text-black border-gray-200"}`}>{m.e} {m.n}</button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">Step 3: Priorities</h3>
          <div className="flex flex-wrap gap-2">
            {priorities.map(p => (
              <button key={p} onClick={() => toggleMatter(p)} className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${matters.includes(p) ? "border-blue-600 bg-blue-50 text-blue-600 shadow-sm" : "border-gray-100 text-gray-400"}`}>{p}</button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">Step 4: Avoid</h3>
          <div className="flex flex-wrap gap-2">
            {avoids.map(a => (
              <button key={a} onClick={() => toggleAvoid(a)} className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${avoid.includes(a) ? "border-red-500 bg-red-50 text-red-500 shadow-sm" : "border-gray-100 text-gray-400"}`}>{a}</button>
            ))}
          </div>
        </section>

        <button onClick={getRec} className="w-full bg-black text-white py-6 rounded-[32px] font-black text-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase">
          {loading ? "Analyzing..." : "Get Recommendation"}
        </button>

        {result && (
          <div className="mt-10 p-8 border-4 border-black rounded-[40px] bg-white text-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in-95">
            <h4 className="text-2xl font-black uppercase italic leading-none">{result.title}</h4>
            <p className="text-blue-600 font-bold mb-2 uppercase tracking-widest text-sm">By {result.author}</p>
            <p className="text-gray-600 border-l-4 border-gray-100 pl-4 italic">"{result.reason}"</p>
          </div>
        )}
      </div>
    </main>
  );
}