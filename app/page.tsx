'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'
import {
  FileEdit, Search, LayoutGrid, Upload, ClipboardPaste, Sparkles,
  ChevronDown, Menu, X, Check, ArrowRight, Zap
} from 'lucide-react'

// ─── Animation Variants ────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
}

// ─── Animated Counter ──────────────────────────────────────────
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-20%' })
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 60, damping: 20 })
  const display = useTransform(spring, (v) => `${prefix}${Math.floor(v).toLocaleString('en-IN')}${suffix}`)
  const [val, setVal] = useState(`${prefix}0${suffix}`)

  useEffect(() => { if (isInView) motionVal.set(target) }, [isInView, target, motionVal])
  useEffect(() => { const unsub = display.on('change', (v) => setVal(v)); return unsub }, [display])

  return <span ref={ref}>{val}</span>
}

// ─── Section Wrapper ───────────────────────────────────────────
function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-20%' })
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={prefersReducedMotion ? 'visible' : 'hidden'}
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.section>
  )
}

// ─── FAQ Item ──────────────────────────────────────────────────
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[#1F1F1F] py-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left cursor-pointer group"
      >
        <span className="text-white text-[15px] font-medium group-hover:text-[#aaa] transition-colors duration-150">
          {question}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown size={18} className="text-[#555]" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="text-[#666] text-sm leading-relaxed pt-3">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────
export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [annual, setAnnual] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const colleges = [
    'IIT Bombay', 'VIT', 'BITS Pilani', 'NIT Trichy', 'Manipal', 'Amrita',
    'Chitkara', 'NMIMS', 'REVA', 'Christ University', 'VCE Mysore', 'PES University',
  ]

  const faqs = [
    {
      q: 'Is InternOS really free to start?',
      a: 'Yes. The free plan gives you 2 full resume tailors and access to 10 matched internships. No credit card required. Upgrade only if you want unlimited access.',
    },
    {
      q: 'How does the AI tailoring actually work?',
      a: 'You paste a job description. Our AI (powered by Claude) reads both your resume and the JD, identifies matching keywords, and rewrites your bullet points to naturally include them — without changing any facts about your experience.',
    },
    {
      q: 'Will my resume still sound like me?',
      a: 'Yes. The AI only rewrites structure and keywords — your experiences, projects, and achievements stay exactly as you wrote them. We optimize, not fabricate.',
    },
    {
      q: 'Is my data safe?',
      a: "InternOS is compliant with India's DPDP Act 2023. Your resume data is encrypted, never used to train AI models, and you can delete it anytime from settings.",
    },
    {
      q: 'Do you support non-tech internships?',
      a: 'Absolutely. InternOS has listings and tailoring support for Marketing, Design, Finance, Operations, HR, and more — not just engineering roles.',
    },
  ]

  return (
    <div className="relative min-h-screen bg-[#050505] text-[#F5F5F5] overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Background radial gradient */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at center, #0A0A14 0%, #050505 70%)' }} />

      {/* ══════════════ NAVBAR ══════════════ */}
      <motion.nav
        initial={prefersReducedMotion ? {} : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl bg-black/60 border-b border-[#1F1F1F]"
      >
        <div className="max-w-[1100px] mx-auto px-6 h-[60px] flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
            <span className="text-white font-bold text-lg">InternOS</span>
            <span className="text-white font-bold text-lg" style={{ animation: 'blink 0.7s steps(1) infinite' }}>|</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'How it works', 'Pricing', 'FAQ'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-sm text-[#777] hover:text-white transition-colors duration-150"
              >
                {item}
              </a>
            ))}
          </div>

          {/* Right buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button className="text-white text-sm hover:bg-white/5 px-4 py-1.5 rounded-md transition-all duration-150 cursor-pointer">
              Log in
            </button>
            <button className="bg-[#3B82F6] hover:bg-[#60A5FA] text-black font-semibold text-sm px-4 py-1.5 rounded-md transition-all duration-150 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] cursor-pointer">
              Get Started Free
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white cursor-pointer">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ duration: 0.25 }}
              className="fixed top-[60px] right-0 bottom-0 w-[280px] bg-[#0D0D0D] border-l border-[#1F1F1F] p-6 flex flex-col gap-4 md:hidden z-50"
            >
              {['Features', 'How it works', 'Pricing', 'FAQ'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setMobileOpen(false)}
                  className="text-[#999] text-base hover:text-white transition-colors py-2"
                >
                  {item}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-3">
                <button className="text-white text-sm border border-[#2A2A2A] px-4 py-2.5 rounded-md hover:bg-white/5 transition-all cursor-pointer">Log in</button>
                <button className="bg-[#3B82F6] text-black font-semibold text-sm px-4 py-2.5 rounded-md cursor-pointer">Get Started Free</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ══════════════ HERO ══════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-[60px] px-6 overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-40 z-0" style={{ backgroundImage: 'radial-gradient(circle, #1F1F1F 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Blue blob */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[120px] z-0" style={{ animation: 'float 6s ease-in-out infinite' }} />

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-[200px] z-10" style={{ background: 'linear-gradient(to bottom, transparent, #050505)' }} />

        <div className="relative z-20 max-w-[780px] text-center">
          {/* Badge */}
          <motion.div variants={fadeUp} initial={prefersReducedMotion ? 'visible' : 'hidden'} animate="visible" className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/[0.08] rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" style={{ animation: 'pulse-dot 2s infinite' }} />
            <span className="text-[13px] text-[#999]">✦ Now in beta — free for all students</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            initial={prefersReducedMotion ? 'visible' : 'hidden'}
            animate="visible"
            transition={{ delay: 0.1 }}
            className="text-[40px] md:text-[52px] lg:text-[72px] font-bold leading-[1.05] tracking-tight mb-6"
            style={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            Get Your Dream<br />
            Internship in<br />
            <span className="relative inline-block">
              60 Seconds.
              <svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 300 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2 8 C 50 2, 100 10, 150 6 S 250 2, 298 8"
                  stroke="#3B82F6" strokeWidth="3" strokeLinecap="round"
                  style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: 'draw 0.8s ease forwards 0.6s' }}
                />
              </svg>
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            initial={prefersReducedMotion ? 'visible' : 'hidden'}
            animate="visible"
            transition={{ delay: 0.2 }}
            className="text-[#777] text-base md:text-lg max-w-[520px] mx-auto leading-relaxed mb-8"
          >
            Upload your resume once. InternOS AI tailors it for every opportunity — optimized for ATS, matched to the role, ready in under 2 minutes.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeUp}
            initial={prefersReducedMotion ? 'visible' : 'hidden'}
            animate="visible"
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <button className="bg-[#3B82F6] text-black font-semibold px-6 py-3 rounded-lg text-[15px] hover:bg-[#60A5FA] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 cursor-pointer">
              Tailor My Resume Free →
            </button>
            <button className="border border-[#2A2A2A] text-white px-6 py-3 rounded-lg text-[15px] hover:border-[#444] hover:bg-white/[0.03] transition-all duration-150 cursor-pointer">
              Browse Internships
            </button>
          </motion.div>

          {/* Trust bar */}
          <motion.div
            variants={fadeUp}
            initial={prefersReducedMotion ? 'visible' : 'hidden'}
            animate="visible"
            transition={{ delay: 0.4 }}
            className="flex items-center gap-4 md:gap-6 justify-center mt-8 text-[13px] text-[#555] flex-wrap"
          >
            <span>🎓 500+ students</span>
            <span className="hidden sm:inline">·</span>
            <span>⚡ 2 min avg apply time</span>
            <span className="hidden sm:inline">·</span>
            <span>🏆 Free to start</span>
          </motion.div>

          {/* Floating mock card */}
          <motion.div
            variants={fadeUp}
            initial={prefersReducedMotion ? 'visible' : 'hidden'}
            animate="visible"
            transition={{ delay: 0.5 }}
            className="mt-12 mx-auto max-w-[480px]"
            style={{ animation: prefersReducedMotion ? 'none' : 'float 4s ease-in-out infinite' }}
          >
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-5 flex items-center gap-4 shadow-[0_20px_60px_rgba(59,130,246,0.1)]">
              <div className="w-10 h-10 rounded-lg bg-[#1F1F1F] flex items-center justify-center shrink-0">
                <span className="text-xs text-[#555]">FK</span>
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Flipkart · Frontend Intern</p>
                <p className="text-[#555] text-xs">React, TypeScript, Node.js</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-[#3B82F6]" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                  <AnimatedCounter target={94} suffix="%" />
                </p>
                <p className="text-[10px] text-[#444] uppercase tracking-wider">match</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════ SOCIAL PROOF ══════════════ */}
      <section className="relative z-10 border-t border-b border-[#1F1F1F] bg-[#080808] py-12">
        <p className="text-center text-[#444] text-[11px] uppercase tracking-[0.15em] mb-6">
          Trusted by students from
        </p>

        {/* Marquee */}
        <div className="overflow-hidden mb-10">
          <div className="flex whitespace-nowrap" style={{ animation: 'marquee 20s linear infinite' }}>
            {[...colleges, ...colleges].map((name, i) => (
              <span key={i} className="text-[#555] text-sm font-medium px-8">{name}</span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-[800px] mx-auto grid grid-cols-3 gap-0">
          {[
            { target: 10000, suffix: '+', label: 'Internship listings' },
            { target: 2, suffix: ' min', label: 'Average tailor time' },
            { target: 94, suffix: '%', label: 'Avg ATS match score' },
          ].map((stat, i) => (
            <div key={i} className={`text-center py-4 ${i < 2 ? 'border-r border-[#1F1F1F]' : ''}`}>
              <p className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                <AnimatedCounter target={stat.target} suffix={stat.suffix} />
              </p>
              <p className="text-[#555] text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════ FEATURES ══════════════ */}
      <Section id="features" className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <motion.p variants={staggerItem} className="text-[11px] uppercase tracking-[0.15em] text-[#444] mb-3">FEATURES</motion.p>
          <motion.h2 variants={staggerItem} className="text-3xl md:text-[36px] font-bold text-white mb-3" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
            Everything you need to get hired
          </motion.h2>
          <motion.p variants={staggerItem} className="text-[#666] text-base mb-12">
            One platform. AI-powered. Built for Indian students.
          </motion.p>

          <motion.div variants={staggerContainer} className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: <FileEdit size={18} className="text-[#3B82F6]" />,
                title: 'AI Resume Tailoring',
                body: 'Paste a job description and our AI rewrites your resume with the exact keywords the ATS is looking for. Done in under 2 minutes.',
                pill: 'Powered by Claude AI',
              },
              {
                icon: <Search size={18} className="text-[#3B82F6]" />,
                title: '10,000+ Internships',
                body: 'Discover internships matched to your skills, experience level, and location — updated daily from Internshala, Naukri, and more.',
                pill: 'New listings daily',
              },
              {
                icon: <LayoutGrid size={18} className="text-[#3B82F6]" />,
                title: 'Application Tracker',
                body: 'Track every application in a Kanban board. Know what\'s pending, what\'s moving, and never miss a deadline again.',
                pill: 'Free on all plans',
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={staggerItem}
                className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6 hover:border-[#2A2A2A] hover:bg-[#111] hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(59,130,246,0.05)] transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  {card.icon}
                </div>
                <h3 className="text-base font-semibold text-white mt-4">{card.title}</h3>
                <p className="text-[#666] text-sm mt-2 leading-relaxed">{card.body}</p>
                <span className="inline-block border border-[#1F1F1F] text-[#444] text-[11px] rounded-full px-3 py-1 mt-4">
                  {card.pill}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <Section id="how-it-works" className="py-24 px-6 bg-[#080808]">
        <div className="max-w-[900px] mx-auto">
          <motion.p variants={staggerItem} className="text-[11px] uppercase tracking-[0.15em] text-[#444] mb-3">HOW IT WORKS</motion.p>
          <motion.h2 variants={staggerItem} className="text-2xl md:text-[36px] font-bold text-white mb-16" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
            From resume to tailored application in 3 steps
          </motion.h2>

          <motion.div variants={staggerContainer} className="grid md:grid-cols-3 gap-8 relative">
            {/* Dashed connection line (desktop only) */}
            <div className="hidden md:block absolute top-12 left-[16.5%] right-[16.5%] h-[1px] border-t-2 border-dashed border-[#1F1F1F] z-0" />

            {[
              { icon: <Upload size={20} className="text-[#777]" />, step: '01', label: 'STEP 01', title: 'Upload your resume', body: 'Drop your PDF or DOCX. We parse it instantly and extract your skills, experience, and preferred roles.' },
              { icon: <ClipboardPaste size={20} className="text-[#777]" />, step: '02', label: 'STEP 02', title: 'Paste the job description', body: 'Found an internship you love? Paste the JD and InternOS identifies every keyword and requirement.' },
              { icon: <Sparkles size={20} className="text-[#777]" />, step: '03', label: 'STEP 03', title: 'Download your tailored resume', body: 'Your resume is rewritten in seconds — keywords injected, ATS optimized, ready to send. Your facts, our formatting.' },
            ].map((s, i) => (
              <motion.div key={i} variants={staggerItem} className="relative text-center">
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[64px] font-bold text-[#111] pointer-events-none select-none" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                  {s.step}
                </span>
                <div className="relative z-10 bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6">
                  <div className="w-12 h-12 border border-[#2A2A2A] rounded-full flex items-center justify-center mx-auto">
                    {s.icon}
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#3B82F6] mt-4">{s.label}</p>
                  <h3 className="text-base font-semibold text-white mt-2">{s.title}</h3>
                  <p className="text-[#666] text-sm mt-2 leading-relaxed">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ══════════════ PRICING ══════════════ */}
      <Section id="pricing" className="py-24 px-6">
        <div className="max-w-[1000px] mx-auto">
          <motion.p variants={staggerItem} className="text-[11px] uppercase tracking-[0.15em] text-[#444] mb-3">PRICING</motion.p>
          <motion.h2 variants={staggerItem} className="text-2xl md:text-[36px] font-bold text-white mb-3" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
            Pricing that respects a student&apos;s budget
          </motion.h2>
          <motion.p variants={staggerItem} className="text-[#666] mb-10">Start free. Upgrade when you&apos;re ready.</motion.p>

          {/* Toggle */}
          <motion.div variants={staggerItem} className="flex justify-center mb-10">
            <div className="inline-flex bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg p-1">
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-md text-sm transition-all cursor-pointer ${!annual ? 'bg-white text-black font-medium' : 'text-[#777]'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-md text-sm transition-all cursor-pointer flex items-center gap-2 ${annual ? 'bg-white text-black font-medium' : 'text-[#777]'}`}
              >
                Annual
                <span className="bg-blue-500/10 text-[#60A5FA] text-[10px] px-2 py-0.5 rounded-full font-medium">Save 44%</span>
              </button>
            </div>
          </motion.div>

          <motion.div variants={staggerContainer} className="grid md:grid-cols-3 gap-4 items-start">
            {/* FREE */}
            <motion.div variants={staggerItem} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#555]">FREE</p>
              <p className="mt-3">
                <span className="text-[40px] font-bold text-white" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>₹0</span>
                <span className="text-[#555] text-sm ml-1"> / month</span>
              </p>
              <div className="border-t border-[#1F1F1F] my-4" />
              <ul className="space-y-3">
                {['2 resume tailors total', '10 internship matches', 'Basic application tracking', 'No cover letters'].map((f, i) => (
                  <li key={i} className="text-[#666] text-sm flex items-start gap-2">
                    <ArrowRight size={14} className="mt-0.5 shrink-0 text-[#444]" /> {f}
                  </li>
                ))}
              </ul>
              <button className="mt-6 w-full border border-[#2A2A2A] text-white py-2.5 rounded-lg text-sm hover:border-[#444] hover:bg-white/[0.03] transition-all cursor-pointer">
                Get started free
              </button>
            </motion.div>

            {/* PRO */}
            <motion.div variants={staggerItem} className="bg-gradient-to-br from-[#0D0D0D] to-[#0D1220] border border-blue-500/40 rounded-xl p-6 scale-[1.02] shadow-[0_0_60px_rgba(59,130,246,0.12)] relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500/10 text-[#60A5FA] border border-blue-500/20 text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-full font-medium">
                Most Popular
              </span>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#555] mt-2">PRO</p>
              <p className="mt-3">
                {annual ? (
                  <>
                    <span className="text-[40px] font-bold text-white" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>₹166</span>
                    <span className="text-[#555] text-sm ml-2 line-through decoration-red-500">₹299</span>
                    <span className="text-[#555] text-sm"> / mo</span>
                  </>
                ) : (
                  <>
                    <span className="text-[40px] font-bold text-white" style={{ fontFamily: "'Geist Mono', monospace" }}>₹299</span>
                    <span className="text-[#555] text-sm ml-1"> / month</span>
                  </>
                )}
              </p>
              <div className="border-t border-[#1F1F1F] my-4" />
              <ul className="space-y-3">
                {[
                  'Unlimited tailoring', 'Unlimited internship matches', 'AI cover letter generation',
                  'Full application tracker', 'Email alerts for new matches', 'Priority matching algorithm',
                ].map((f, i) => (
                  <li key={i} className="text-[#ccc] text-sm flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-1.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button className="mt-6 w-full bg-[#3B82F6] text-black font-semibold py-2.5 rounded-lg text-sm hover:bg-[#60A5FA] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all cursor-pointer">
                Upgrade to Pro
              </button>
            </motion.div>

            {/* ANNUAL */}
            <motion.div variants={staggerItem} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#555]">ANNUAL</p>
              <p className="mt-3">
                <span className="text-[40px] font-bold text-white" style={{ fontFamily: "'Geist Mono', monospace" }}>₹1,999</span>
                <span className="text-[#555] text-sm ml-1"> / year</span>
              </p>
              <p className="text-[#555] text-xs">₹166/mo</p>
              <span className="inline-block bg-blue-500/10 text-[#60A5FA] text-[10px] px-3 py-1 rounded-full mt-2 font-medium">
                Best value · Save ₹1,589
              </span>
              <div className="border-t border-[#1F1F1F] my-4" />
              <ul className="space-y-3">
                {[
                  'Unlimited tailoring', 'Unlimited internship matches', 'AI cover letter generation',
                  'Full application tracker', 'Email alerts for new matches', 'Priority matching algorithm',
                  'Early access to new features',
                ].map((f, i) => (
                  <li key={i} className="text-[#666] text-sm flex items-start gap-2">
                    <ArrowRight size={14} className="mt-0.5 shrink-0 text-[#444]" /> {f}
                  </li>
                ))}
              </ul>
              <button className="mt-6 w-full border border-[#2A2A2A] text-white py-2.5 rounded-lg text-sm hover:border-[#444] hover:bg-white/[0.03] transition-all cursor-pointer">
                Get annual plan
              </button>
            </motion.div>
          </motion.div>

          <p className="text-center text-[#555] text-sm mt-8 flex items-center justify-center gap-1.5">
            <Zap size={14} className="text-[#555]" />
            First month 50% off — pay just ₹149 to start
          </p>
        </div>
      </Section>

      {/* ══════════════ FAQ ══════════════ */}
      <Section id="faq" className="py-24 px-6">
        <div className="max-w-[680px] mx-auto">
          <motion.p variants={staggerItem} className="text-[11px] uppercase tracking-[0.15em] text-[#444] mb-3">FAQ</motion.p>
          <motion.h2 variants={staggerItem} className="text-2xl md:text-[36px] font-bold text-white mb-10" style={{ fontFamily: "'Geist Mono', monospace" }}>
            Questions? Answered.
          </motion.h2>

          <motion.div variants={staggerItem}>
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ══════════════ FOOTER CTA ══════════════ */}
      <section className="relative py-24 px-6 border-t border-[#1F1F1F]" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 70%)' }}>
        <div className="max-w-[600px] mx-auto text-center relative z-10">
          <div className="inline-flex items-center border border-blue-500/20 text-[#60A5FA] text-[13px] rounded-full px-4 py-1.5 mb-6">
            ✦ Free to start
          </div>
          <h2 className="text-3xl md:text-[48px] font-bold text-white leading-tight" style={{ fontFamily: "'Geist Mono', monospace" }}>
            Your dream internship is 60 seconds away.
          </h2>
          <p className="text-[#666] text-base mt-4 leading-relaxed">
            Join 500+ students from tier-2 colleges who stopped getting rejected and started getting interviews.
          </p>
          <button className="mt-8 bg-[#3B82F6] text-black font-semibold px-8 py-4 rounded-lg text-[16px] hover:bg-[#60A5FA] hover:shadow-[0_0_50px_rgba(59,130,246,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
            Tailor My Resume Free →
          </button>
          <p className="text-[#444] text-xs mt-3">No credit card. No setup. Just paste your JD.</p>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="bg-[#080808] border-t border-[#1F1F1F] py-10 px-6">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Left */}
          <div>
            <div className="flex items-center" style={{ fontFamily: "'Geist Mono', monospace" }}>
              <span className="text-white font-bold text-lg">InternOS</span>
              <span className="text-white font-bold text-lg" style={{ animation: 'blink 0.7s steps(1) infinite' }}>|</span>
            </div>
            <p className="text-[#444] text-xs mt-1">Find internships. Tailor resumes. Get hired.</p>
            <p className="text-[#333] text-xs mt-4">Made with ♥ for Indian students</p>
          </div>

          {/* Center */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#333] mb-3">PRODUCT</p>
            <div className="flex flex-col gap-2">
              {['Features', 'How it works', 'Pricing', 'FAQ'].map((item) => (
                <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="text-[#555] text-sm hover:text-white transition-colors">
                  {item}
                </a>
              ))}
            </div>
          </div>

          {/* Right */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#333] mb-3">LEGAL</p>
            <div className="flex flex-col gap-2">
              {['Privacy Policy', 'Terms of Service', 'DPDP Compliance'].map((item) => (
                <a key={item} href="#" className="text-[#555] text-sm hover:text-white transition-colors">
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-[1100px] mx-auto border-t border-[#1F1F1F] pt-6 mt-6 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-[#333] text-xs">© 2026 InternOS. All rights reserved.</p>
          <p className="text-[#2A2A2A] text-xs">Built for the 94% who deserve better opportunities.</p>
        </div>
      </footer>
    </div>
  )
}
