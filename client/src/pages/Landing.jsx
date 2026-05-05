import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const FEATURES = [
  { icon: '😬', tag: 'Psychological', title: 'Regret Tracker', desc: 'Rate each spend 24h later. Discover which categories you actually enjoy vs always regret.' },
  { icon: '⏰', tag: 'Eye-Opening',   title: 'Time Cost of Money', desc: 'Every expense shows hours of work it cost you. ₹500 = 1.2 hrs of your life.' },
  { icon: '🧠', tag: 'Behavioral',    title: 'Mood-Spend Link', desc: 'Log your daily mood. VAULT reveals you spend 2.7x more on stressed days.' },
  { icon: '🌱', tag: 'Investment',    title: 'Future Self Mode', desc: "See what today's ₹500 becomes in 10 years if invested at 12% SIP." },
  { icon: '👻', tag: 'Auto-Detect',   title: 'Ghost Money Finder', desc: 'Finds forgotten subscriptions quietly draining you every month.' },
  { icon: '🔓', tag: 'Mental Health', title: 'Guilt-Free Zone', desc: 'A small fund you can spend freely. No tracking, no judgment.' },
  { icon: '🔥', tag: 'Gamified',      title: 'Zero-Day Streaks', desc: 'Gamified no-spend days with levels and badges. Build discipline like a game.' },
  { icon: '🧬', tag: 'Identity',      title: 'Spend DNA', desc: 'Your money personality: Comfort Spender, Impulse Buyer, Experience Chaser, or Disciplined Saver.' },
];

const testimonials = [
  { name: 'Priya S.', role: 'Software Engineer', text: 'VAULT showed me I was spending ₹4,200/month on food delivery I regretted. I cut it in half.', rating: 5 },
  { name: 'Rahul M.', role: 'Product Manager', text: 'The Ghost Money feature found 3 subscriptions I forgot about. ₹1,800/month saved instantly!', rating: 5 },
  { name: 'Sneha K.', role: 'Designer', text: 'Mood & Spend showed me I spend 3x more on sad days. That awareness alone changed my habits.', rating: 5 },
];

export default function Landing() {
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);

  const quizQuestions = [
    { q: "You're stressed after a long day. What do you do?", options: ['Order food delivery', 'Go for a walk', 'Buy something online', 'Watch Netflix'] },
    { q: 'You get a bonus this month. You...', options: ['Invest it immediately', 'Plan a trip', 'Go on a shopping spree', 'Pay pending bills'] },
    { q: 'After buying something, you often feel...', options: ['Happy and satisfied', 'Guilty after a day', 'Neutral — it was needed', 'Excited at first, regretful later'] },
  ];

  const dnaResults = ['Comfort Spender', 'Disciplined Saver', 'Impulse Buyer', 'Experience Chaser'];

  const handleQuizAnswer = (ansIdx) => {
    const newAnswers = [...quizAnswers, ansIdx];
    setQuizAnswers(newAnswers);
    if (quizStep < 2) {
      setQuizStep(quizStep + 1);
    } else {
      const sum = newAnswers.reduce((s, a) => s + a, 0);
      setQuizResult(dnaResults[sum % 4]);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#05060F', position: 'relative', overflow: 'hidden' }}>

      {/* Background mesh */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 25% 35%, rgba(245,166,35,0.11) 0%, transparent 55%),
          radial-gradient(ellipse at 75% 65%, rgba(0,201,167,0.07) 0%, transparent 55%),
          radial-gradient(ellipse at 55% 20%, rgba(139,122,255,0.06) 0%, transparent 45%)
        `
      }} />

      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(5,6,15,0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        padding: '0 40px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="logo-pulse" style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(145deg,#F7B733,#E08A00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(245,166,35,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
          }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 16 }}>V</span>
          </div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: '#EAEDF5' }}>VAULT</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/login" style={{ color: '#9295A8', fontFamily: 'Inter', fontSize: 14, textDecoration: 'none', padding: '8px 16px', borderRadius: 10, transition: 'all 0.2s', border: '0.5px solid transparent' }}>
            Sign In
          </Link>
          <Link to="/register" className="btn-amber" style={{ textDecoration: 'none', padding: '10px 22px', fontSize: 14, borderRadius: 10 }}>
            Get Started →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '100px 24px 60px', position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(245,166,35,0.1)', border: '0.5px solid rgba(245,166,35,0.28)',
            borderRadius: 100, padding: '6px 16px', marginBottom: 32,
            fontSize: 12, fontFamily: 'Inter', fontWeight: 500, color: '#F5A623',
            letterSpacing: '0.04em'
          }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5A623', boxShadow: '0 0 6px #F5A623', display: 'inline-block' }} />
          YOUR PERSONAL FINANCE INTELLIGENCE LAYER
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6, ease: [0.16,1,0.3,1] }}
          style={{
            fontFamily: 'Outfit', fontWeight: 800,
            fontSize: 'clamp(44px, 8vw, 92px)',
            lineHeight: 0.95, letterSpacing: '-0.04em',
            color: '#EAEDF5', marginBottom: 28, maxWidth: 900
          }}>
          Know <span className="gtext-hero">exactly</span><br />where your<br />money goes
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          style={{ fontFamily: 'Inter', fontSize: 'clamp(15px,2vw,18px)', color: '#9295A8', maxWidth: 560, lineHeight: 1.65, marginBottom: 44 }}>
          Not just an expense tracker. VAULT reveals the <em style={{ color: '#EAEDF5', fontStyle: 'italic' }}>psychology</em> behind your spending — what you regret, what your habits cost you in 10 years, and your True Free Money after all commitments.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/register" className="btn-amber" style={{ textDecoration: 'none', padding: '16px 36px', fontSize: 16, borderRadius: 12 }}>
            Start for free →
          </Link>
          <button className="btn-ghost" style={{ padding: '16px 32px' }}>
            See how it works
          </button>
        </motion.div>
      </section>

      {/* Features — Brutalist cards */}
      <section style={{ padding: '80px 5% 100px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="sec-div" style={{ margin: '0 auto 14px' }} />
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 'clamp(28px,4vw,48px)', letterSpacing: '-0.03em', color: '#EAEDF5' }}>
            Features no other app has
          </h2>
          <p style={{ fontFamily: 'Inter', color: '#9295A8', fontSize: 16, marginTop: 12 }}>
            Built around the psychology of money, not just pie charts
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          {FEATURES.map((f, i) => (
            <motion.div key={i} className="brutal-card"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              style={{ padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <span style={{ fontSize: 10, fontFamily: 'Outfit', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#666', display: 'block', marginBottom: 6 }}>{f.tag}</span>
              <h3 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17, color: '#05060F', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#555', lineHeight: 1.55 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quiz section */}
      <section style={{ padding: '60px 5% 80px', position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="sec-div" style={{ margin: '0 auto 14px' }} />
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 28, color: '#EAEDF5', letterSpacing: '-0.02em' }}>What's your Spend DNA?</h2>
          <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9295A8', marginTop: 8 }}>Take a 30-second quiz to find out</p>
        </div>

        <div className="gc" style={{ padding: 32 }}>
          {!quizResult ? (
            <div>
              <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#4A4E65', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Question {quizStep + 1} of 3</p>
              <p style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 18, color: '#EAEDF5', marginBottom: 20 }}>{quizQuestions[quizStep].q}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {quizQuestions[quizStep].options.map((opt, i) => (
                  <motion.button key={i} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                    onClick={() => handleQuizAnswer(i)}
                    style={{
                      padding: '14px 18px', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)', color: '#EAEDF5',
                      fontFamily: 'Inter', fontSize: 14, textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}>
                    {opt}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9295A8', marginBottom: 8 }}>Your Spend DNA type is</p>
              <h3 className="gtext-amber" style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 32, marginBottom: 16 }}>{quizResult}</h3>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9295A8', marginBottom: 24 }}>Sign up to see your full DNA profile and personalized insights.</p>
              <Link to="/register" className="btn-amber" style={{ textDecoration: 'none' }}>See my full profile →</Link>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '60px 5% 80px', position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 28, textAlign: 'center', color: '#EAEDF5', marginBottom: 40, letterSpacing: '-0.02em' }}>What users say</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {testimonials.map((t, i) => (
            <motion.div key={i} className="gc"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ padding: 24 }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
                {[...Array(t.rating)].map((_, j) => <Star key={j} size={12} style={{ fill: '#F5A623', color: '#F5A623' }} />)}
              </div>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9295A8', fontStyle: 'italic', marginBottom: 16, lineHeight: 1.6 }}>"{t.text}"</p>
              <div>
                <p style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: '#EAEDF5' }}>{t.name}</p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#4A4E65' }}>{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '60px 5% 80px', position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
        <div className="sec-div" style={{ margin: '0 auto 14px' }} />
        <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 'clamp(28px,4vw,40px)', color: '#EAEDF5', letterSpacing: '-0.03em', marginBottom: 16 }}>Ready to understand your money?</h2>
        <p style={{ fontFamily: 'Inter', fontSize: 16, color: '#9295A8', marginBottom: 32 }}>Free forever. No credit card needed. Start in 60 seconds.</p>
        <Link to="/register" className="btn-amber" style={{ textDecoration: 'none', padding: '16px 40px', fontSize: 16 }}>
          Start for free — it's instant
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '0.5px solid rgba(255,255,255,0.07)', padding: '24px 5%', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(145deg,#F7B733,#E08A00)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Outfit', fontWeight: 800, color: '#1C0E00', fontSize: 8 }}>V</span>
          </div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: '#EAEDF5', fontSize: 14 }}>VAULT</span>
        </div>
        <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#4A4E65' }}>© 2026 VAULT. Know where your money really goes.</p>
      </footer>
    </div>
  );
}
