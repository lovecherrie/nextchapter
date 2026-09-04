"use client";
import { useState } from "react";

export default function NextRead() {
  const [view, setView] = useState("find"); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [reviewType, setReviewType] = useState("full"); 
  
  const [likedBooks, setLikedBooks] = useState("");
  const [dislikedBooks, setDislikedBooks] = useState("");
  const [mood, setMood] = useState("");
  const [matters, setMatters] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [posts, setPosts] = useState([
    { id: 1, user: "Reader_01", title: "The Silent Patient", pacing: 9, twist: 10, boring: 1, comment: "Insane twist!", replies: 12 },
    { id: 2, user: "BookLover", title: "Atomic Habits", pacing: 6, twist: 1, boring: 3, comment: "", replies: 4 }
  ]);

  const [newTitle, setNewTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [revPacing, setRevPacing] = useState(5);
  const [revTwist, setRevTwist] = useState(5);
  const [revBoring, setRevBoring] = useState(5);

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

  const handlePost = () => {
    if (!newTitle) return;
    const newEntry = { id: Date.now(), user: "Guest", title: newTitle, pacing: revPacing, twist: revTwist, boring: revBoring, comment: reviewType === "full" ? newComment : "", replies: 0 };
    setPosts([newEntry, ...posts]);
    setIsModalOpen(false);
    setNewTitle(""); setNewComment("");
  };

  // --- THE FINAL AI FIX (Hardcoded Key for Testing) ---
  const getRec = async () => {
    setLoading(true);
    setResult(null); 
    
    // *** PASTE YOUR GSK_ KEY HERE DIRECTLY FOR TESTING ***
    const TEST_KEY = "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"; // อันนี้คือตัวอย่างนะครับ ใส่ของจริงของคุณลงไป

    try {
      const prompt = `Suggest ONE real book for a reader who:
      - Likes: ${likedBooks}
      - Hates: ${dislikedBooks}
      - Mood: ${mood}
      - Priorities: ${matters.join(", ")}
      - Avoid: ${avoid.join(", ")}
      Respond ONLY with a JSON object: { "title": "Book Title", "author": "Author Name", "reason": "Short explanation." }`;

      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TEST_KEY}` // ใช้คีย์ตรงๆ ไม่ผ่าน Vercel
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "API Error");
      
      const text = data.choices[0].message.content;
      setResult(JSON.parse(text));
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black font-sans relative">
      <nav className="sticky top-0 z-30 bg-white border-b-2 border-black px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tighter cursor-pointer" onClick={() => setView("find")}>NEXTREAD</h1>
        <div className="flex gap-8 text-[10px] font-black uppercase">
          <button onClick={() => setView("find")} className={view === "find" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}>Find Books</button>
          <button onClick={() => setView("community")} className={view === "community" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}>Community Feed</button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-6">
        {view === "find" && (
          <div className="space-y-12 py-6">
            <header><h2 className="text-4xl font-black uppercase italic italic leading-none">Find Your Match</h2></header>
            <section className="space-y-4">
              <h3 className="font-black uppercase text-[10px] text-gray-400">Step 1: History</h3>
              <input className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-black text-black" placeholder="Books you liked..." value={likedBooks} onChange={e=>setLikedBooks(e.target.value)} />
              <input className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-black text-black" placeholder="Books you hated..." value={dislikedBooks} onChange={e=>setDislikedBooks(e.target.value)} />
            </section>
            <section className="space-y-4">
              <h3 className="font-black uppercase text-[10px] text-gray-400">Step 2: Mood</h3>
              <div className="flex flex-wrap gap-2">
                {moods.map(m => (
                  <button key={m.n} onClick={() => setMood(m.n)} className={`px-4 py-3 rounded-xl border-2 font-bold text-sm ${mood === m.n ? "bg-black text-white border-black" : "border-gray-100 bg-white text-black"}`}>{m.e} {m.n}</button>
                ))}
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="font-black uppercase text-[10px] text-gray-400">Step 3: Priorities</h3>
              <div className="flex flex-wrap gap-2">
                {priorities.map(p => (
                  <button key={p} onClick={() => toggleMatter(p)} className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${matters.includes(p) ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-100 text-gray-400"}`}>{p}</button>
                ))}
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="font-black uppercase text-[10px] text-gray-400">Step 4: Avoid</h3>
              <div className="flex flex-wrap gap-2">
                {avoids.map(a => (
                  <button key={a} onClick={() => toggleAvoid(a)} className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${avoid.includes(a) ? "border-red-500 bg-red-50 text-red-500" : "border-gray-100 text-gray-400"}`}>{a}</button>
                ))}
              </div>
            </section>
            <button onClick={getRec} className="w-full bg-black text-white py-6 rounded-[32px] font-black text-xl shadow-xl active:scale-95 transition uppercase">
              {loading ? "Analyzing..." : "Get Recommendation"}
            </button>
            {result && (
              <div className="mt-8 p-8 border-4 border-black rounded-[40px] bg-white animate-in zoom-in-95 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-black text-center">
                <h4 className="text-2xl font-black italic uppercase leading-none">{result.title}</h4>
                <p className="text-blue-600 font-bold mb-4 uppercase text-xs tracking-widest">By {result.author}</p>
                <p className="text-sm text-gray-600 italic">"{result.reason}"</p>
              </div>
            )}
          </div>
        )}

        {view === "community" && (
          <div className="space-y-10 py-6 pb-24 text-black">
            <header><h2 className="text-4xl font-black uppercase italic leading-none tracking-tighter">Reader's Feed</h2></header>
            {posts.map(post => (
              <div key={post.id} className="border-4 border-black rounded-[32px] p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white space-y-4">
                <span className="bg-yellow-300 px-2 py-1 text-[10px] font-black uppercase inline-block">@{post.user}</span>
                <h3 className="text-2xl font-black uppercase italic leading-tight">{post.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-black border-2 border-black px-2 py-1 rounded-full uppercase">Pacing: {post.pacing}/10</span>
                </div>
                {post.comment && <p className="text-sm bg-gray-50 p-4 rounded-2xl border-2 border-dashed border-gray-200 italic">"{post.comment}"</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {view === "community" && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-8 right-8 w-16 h-16 bg-black text-white rounded-2xl shadow-2xl flex items-center justify-center text-3xl border-4 border-white transition-all z-40">+</button>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-lg rounded-[40px] p-8 relative border-4 border-black">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 font-black uppercase text-[10px] underline">Close [X]</button>
            <h2 className="text-2xl font-black uppercase italic mb-8">Post Review</h2>
            <div className="space-y-6">
              <input className="w-full p-4 border-2 border-gray-200 rounded-2xl font-bold text-black outline-none" placeholder="Book Title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
              <textarea className="w-full p-4 border-2 border-gray-200 rounded-2xl h-32 text-black outline-none" placeholder="Thoughts..." value={newComment} onChange={e=>setNewComment(e.target.value)} />
              <button onClick={handlePost} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase">Post to Community</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}