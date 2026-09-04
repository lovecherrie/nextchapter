"use client";
import { useState } from "react";

export default function NextRead() {
  const [view, setView] = useState("find"); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [reviewType, setReviewType] = useState("full"); 
  
  // --- AI Finder States ---
  const [likedBooks, setLikedBooks] = useState("");
  const [dislikedBooks, setDislikedBooks] = useState("");
  const [mood, setMood] = useState("");
  const [matters, setMatters] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // --- Community States ---
  const [posts, setPosts] = useState([
    {
      id: 1, user: "Reader_01", title: "The Silent Patient",
      pacing: 9, twist: 10, boring: 1,
      comment: "The plot twist was insane! Highly recommend if you love mystery.",
      replies: 12
    },
    {
      id: 2, user: "BookLover", title: "Atomic Habits",
      pacing: 6, twist: 1, boring: 3,
      comment: "",
      replies: 4
    }
  ]);

  const [newTitle, setNewTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [revPacing, setRevPacing] = useState(5);
  const [revTwist, setRevTwist] = useState(5);
  const [revBoring, setRevBoring] = useState(5);

  const moods = [{n:"Mind-bending",e:"🧠"}, {n:"Emotional",e:"😢"}, {n:"Dark",e:"😱"}, {n:"Romantic",e:"💕"}, {n:"Fun",e:"😂"}, {n:"Mystery",e:"🕵️"}, {n:"Cozy",e:"🫶"}, {n:"Fast-paced",e:"⚡"}];
  const priorities = ["Plot twists", "Characters", "Fast pacing", "Atmosphere", "Mystery", "Writing style", "Emotional impact"];
  const avoids = ["Slow burn", "Romance", "Horror", "Gore", "Fantasy", "Sad ending", "Too long", "Nothing"];

  const toggleMatter = (item: string) => {
    if (matters.includes(item)) setMatters(matters.filter(i => i !== item));
    else if (matters.length < 2) setMatters([...matters, item]);
  };

  const toggleAvoid = (item: string) => {
    if (item === "Nothing") setAvoid(["Nothing"]);
    else setAvoid(avoid.filter(i => i !== "Nothing").includes(item) ? avoid.filter(i => i !== item) : [...avoid.filter(i => i !== "Nothing"), item]);
  };

  const handlePost = () => {
    if (!newTitle) return;
    const newEntry = {
      id: Date.now(), user: "Guest", title: newTitle,
      pacing: revPacing, twist: revTwist, boring: revBoring,
      comment: reviewType === "full" ? newComment : "", 
      replies: 0
    };
    setPosts([newEntry, ...posts]);
    setIsModalOpen(false);
    setNewTitle(""); setNewComment("");
  };

  // --- THE REAL AI BRAIN ---
  const getRec = async () => {
    setLoading(true);
    setResult(null); 
    try {
      const prompt = `Suggest ONE real book for a reader who:
      - Likes: ${likedBooks}
      - Hates: ${dislikedBooks}
      - Current Mood: ${mood}
      - Cares most about: ${matters.join(", ")}
      - Wants to avoid: ${avoid.join(", ")}
      
      Respond ONLY with a JSON object in this format:
      { "title": "Book Title", "author": "Author Name", "reason": "A 2-sentence explanation why this matches their specific mood and avoid list." }`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_AI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const text = data.candidates[0].content.parts[0].text;
        const cleanJson = text.replace(/```json|```/g, "").trim();
        setResult(JSON.parse(cleanJson));
      } else {
        throw new Error("AI Error");
      }
    } catch (error) {
      console.error("AI Error:", error);
      alert("AI is a bit sleepy. Check your API Key or try again!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black font-sans relative">
      {/* Navigation */}
      <nav className="sticky top-0 z-30 bg-white border-b-2 border-black px-6 py-4 flex justify-between items-center text-black">
        <h1 className="text-2xl font-black tracking-tighter cursor-pointer" onClick={() => setView("find")}>NEXTREAD</h1>
        <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-black">
          <button onClick={() => setView("find")} className={view === "find" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}>Find Books</button>
          <button onClick={() => setView("community")} className={view === "community" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}>Community Feed</button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-6 text-black">
        {/* --- PAGE 1: FIND BOOKS --- */}
        {view === "find" && (
          <div className="space-y-12 py-6 pb-20">
            <header><h2 className="text-4xl font-black uppercase italic leading-none text-black">Find Your Match</h2></header>
            
            <section className="space-y-4">
              <h3 className="font-black uppercase text-[10px] tracking-widest text-gray-400 underline">Step 1: History</h3>
              <input className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-black text-black" placeholder="Books you liked..." value={likedBooks} onChange={e=>setLikedBooks(e.target.value)} />
              <input className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-black text-black" placeholder="Books you hated..." value={dislikedBooks} onChange={e=>setDislikedBooks(e.target.value)} />
            </section>

            <section className="space-y-4">
              <h3 className="font-black uppercase text-[10px] tracking-widest text-gray-400 underline">Step 2: Mood</h3>
              <div className="flex flex-wrap gap-2 text-black">
                {moods.map(m => (
                  <button key={m.n} onClick={() => setMood(m.n)} className={`px-4 py-3 rounded-xl border-2 font-bold text-sm ${mood === m.n ? "bg-black text-white border-black" : "border-gray-100 bg-white text-black"}`}>{m.e} {m.n}</button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-black uppercase text-[10px] tracking-widest text-gray-400 underline text-black">Step 3: Priorities (Max 2)</h3>
              <div className="flex flex-wrap gap-2 text-black">
                {priorities.map(p => (
                  <button key={p} onClick={() => toggleMatter(p)} className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${matters.includes(p) ? "border-blue-600 bg-blue-50 text-blue-600 shadow-sm font-black" : "border-gray-100 text-gray-400"}`}>{p}</button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-black uppercase text-[10px] tracking-widest text-gray-400 underline text-black">Step 4: Avoid List</h3>
              <div className="flex flex-wrap gap-2 text-black">
                {avoids.map(a => (
                  <button key={a} onClick={() => toggleAvoid(a)} className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${avoid.includes(a) ? "border-red-500 bg-red-50 text-red-500 shadow-sm font-black" : "border-gray-100 text-gray-400"}`}>{a}</button>
                ))}
              </div>
            </section>

            <button onClick={getRec} className="w-full bg-black text-white py-6 rounded-[32px] font-black text-xl shadow-xl active:scale-95 transition">
              {loading ? "ANALYZING..." : "GENERATE RECOMMENDATION"}
            </button>

            {result && (
              <div className="mt-8 p-8 border-4 border-black rounded-[40px] bg-white animate-in zoom-in-95 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-black">
                <h4 className="text-2xl font-black italic uppercase leading-none">{result.title}</h4>
                <p className="text-blue-600 font-bold mb-4 uppercase text-xs tracking-widest">By {result.author}</p>
                <p className="text-sm text-gray-600 italic">"{result.reason}"</p>
              </div>
            )}
          </div>
        )}

        {/* --- PAGE 2: COMMUNITY FEED --- */}
        {view === "community" && (
          <div className="space-y-10 py-6 pb-24 text-black">
            <header><h2 className="text-4xl font-black uppercase italic leading-none tracking-tighter text-black">Reader's Feed</h2></header>
            {posts.map(post => (
              <div key={post.id} className="border-4 border-black rounded-[32px] p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white space-y-4">
                <span className="bg-yellow-300 px-2 py-1 text-[10px] font-black uppercase inline-block">@{post.user}</span>
                <h3 className="text-2xl font-black uppercase italic leading-tight text-black">{post.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-black border-2 border-black px-2 py-1 rounded-full text-black italic">PACING: {post.pacing}/10</span>
                  <span className="text-[10px] font-black border-2 border-black px-2 py-1 rounded-full text-black italic">TWIST: {post.twist}/10</span>
                  <span className="text-[10px] font-black border-2 border-black px-2 py-1 rounded-full text-black italic">BOREDOM: {post.boring}/10</span>
                </div>
                {post.comment && <p className="text-sm bg-gray-50 p-4 rounded-2xl border-2 border-dashed border-gray-200">"{post.comment}"</p>}
                <div className="flex gap-6 pt-4 border-t border-gray-100">
                   <button className="text-[10px] font-black uppercase hover:underline">💬 {post.replies} Discussions</button>
                   <button className="text-[10px] font-black uppercase hover:underline text-red-600">🔥 Debate</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- FLOATING SPROUT BUTTON (Community Only) --- */}
      {view === "community" && (
        <div className="fixed bottom-8 right-8 flex flex-col items-end gap-3 z-40 text-black">
          {isMenuOpen && (
            <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-2 duration-200">
              <button 
                onClick={() => { setReviewType("full"); setIsModalOpen(true); setIsMenuOpen(false); }}
                className="bg-white border-2 border-black px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-gray-50 text-black"
              >
                Post Review
              </button>
              <button 
                onClick={() => { setReviewType("quick"); setIsModalOpen(true); setIsMenuOpen(false); }}
                className="bg-white border-2 border-black px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-gray-50 text-black"
              >
                Quick Rate
              </button>
            </div>
          )}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-14 h-14 bg-black text-white rounded-2xl shadow-2xl flex items-center justify-center text-2xl border-2 border-white transition-all duration-300 ${isMenuOpen ? "rotate-45 bg-red-600" : ""}`}
          >
            +
          </button>
        </div>
      )}

      {/* --- REVIEW MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6 text-black">
          <div className="bg-white w-full max-w-lg rounded-[40px] p-8 relative max-h-[90vh] overflow-y-auto border-4 border-black text-black">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 font-black uppercase text-[10px] underline text-black">Close [X]</button>
            <h2 className="text-3xl font-black uppercase italic mb-8 tracking-tighter text-black font-sans">Post Review</h2>
            
            <div className="space-y-6">
              <input className="w-full p-4 border-2 border-gray-200 rounded-2xl font-bold outline-none text-black" placeholder="Book Title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
              
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-black"><span>Pacing</span><span>{revPacing}/10</span></div>
                  <input type="range" className="w-full accent-black" value={revPacing} onChange={e=>setRevPacing(parseInt(e.target.value))} min="1" max="10" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-black"><span>Plot Twist</span><span>{revTwist}/10</span></div>
                  <input type="range" className="w-full accent-black" value={revTwist} onChange={e=>setRevTwist(parseInt(e.target.value))} min="1" max="10" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-black"><span>Boredom</span><span>{revBoring}/10</span></div>
                  <input type="range" className="w-full accent-black" value={revBoring} onChange={e=>setRevBoring(parseInt(e.target.value))} min="1" max="10" />
                </div>
              </div>

              {reviewType === "full" && (
                <textarea className="w-full p-4 border-2 border-gray-200 rounded-2xl h-32 outline-none font-medium text-black" placeholder="Write your thoughts..." value={newComment} onChange={e=>setNewComment(e.target.value)} />
              )}

              <button onClick={handlePost} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition">
                {reviewType === "full" ? "Publish Post" : "Submit Rating"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}