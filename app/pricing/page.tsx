"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  Zap,
  Sparkles,
  Mail,
  Shield,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "",
    description: "Get started with the basics",
    features: [
      "2 resume tailors total",
      "10 internship matches",
      "Basic application tracking",
      "No cover letters",
    ],
    cta: "Current Plan",
    ctaStyle: "disabled" as const,
    popular: false,
  },
  {
    name: "Pro",
    price: "₹299",
    period: "/ month",
    description: "Everything you need to land internships",
    features: [
      "Unlimited resume tailoring",
      "Unlimited internship matches",
      "AI cover letter generation",
      "Full application tracker",
      "Email alerts for new matches",
      "Priority matching algorithm",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    ctaStyle: "primary" as const,
    popular: true,
  },
  {
    name: "Annual",
    price: "₹1,999",
    period: "/ year",
    description: "Best value — save 44%",
    features: [
      "Everything in Pro",
      "Save ₹1,589 vs monthly",
      "Early access to new features",
      "Dedicated account support",
      "Custom resume templates",
      "Advanced analytics dashboard",
    ],
    cta: "Get Annual Plan",
    ctaStyle: "secondary" as const,
    popular: false,
  },
];

const faqs = [
  {
    q: "Can I try Pro before paying?",
    a: "Yes! Every new user gets 2 free resume tailors and 10 internship matches. You can experience the core features before deciding to upgrade. No credit card required to start.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Absolutely. You can cancel your Pro or Annual subscription at any time from your account settings. You'll continue to have access until the end of your billing period.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a 7-day money-back guarantee on all paid plans. If you're not satisfied within the first 7 days, contact us for a full refund — no questions asked.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06] py-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left cursor-pointer group"
      >
        <span className="text-white text-[15px] font-medium group-hover:text-[#ccc] transition-colors">
          {question}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} className="text-[#555]" />
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <p className="text-[#666] text-sm leading-relaxed pt-3">{answer}</p>
      </motion.div>
    </div>
  );
}

function handleUpgrade() {
  alert("Coming soon! Payment integration in Phase 2.\n\nFor early Pro access, contact vinay@internos.in");
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, #0A1128 0%, #030303 50%, #030303 100%)",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-[#777] hover:text-white transition-colors">
              <ArrowLeft size={16} />
              <span className="text-sm">Dashboard</span>
            </Link>
            <Link href="/" className="flex items-center font-mono">
              <span className="text-white font-bold text-lg">InternOS</span>
              <span className="text-white font-bold text-lg animate-blink">|</span>
            </Link>
          </div>
          <Link
            href="/dashboard"
            className="bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-[1100px] mx-auto px-6 py-20">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 border border-blue-500/20 bg-blue-500/[0.08] rounded-full px-4 py-1.5 mb-6">
            <Sparkles size={14} className="text-[#3B82F6]" />
            <span className="text-xs text-[#999]">Simple, student-friendly pricing</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4 font-mono">
            Upgrade to Pro
          </h1>
          <p className="text-[#777] text-lg max-w-[500px] mx-auto">
            Unlock unlimited resume tailoring and land more interviews.
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-24">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.1 * (i + 1) }}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.popular
                  ? "bg-gradient-to-b from-[#1E293B]/40 to-[#0F172A]/80 border-2 border-[#3B82F6]/60 shadow-[0_0_60px_rgba(37,99,235,0.15)] scale-[1.02]"
                  : "bg-gradient-to-b from-[#0E0E11] to-[#050505] border border-white/[0.08]"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[10px] uppercase tracking-[0.15em] px-4 py-1.5 rounded-full font-bold shadow-lg">
                  Most Popular
                </span>
              )}

              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A1A1AA] mb-3">
                  {plan.name}
                </p>
                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white tracking-tighter font-mono">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-[#666] text-sm">{plan.period}</span>
                  )}
                </p>
                <p className="text-[#666] text-sm mt-2">{plan.description}</p>
              </div>

              <div className="border-t border-white/[0.08] my-4" />

              <ul className="space-y-3.5 flex-1 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-[15px]">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        plan.popular
                          ? "bg-blue-500/20"
                          : "bg-white/5"
                      }`}
                    >
                      <Check
                        size={12}
                        className={plan.popular ? "text-blue-400" : "text-[#666]"}
                      />
                    </div>
                    <span className={plan.popular ? "text-white" : "text-[#999]"}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.ctaStyle === "disabled" ? (
                <button
                  disabled
                  className="w-full py-3.5 rounded-xl text-[15px] font-semibold transition-all cursor-not-allowed bg-white/5 text-[#555] border border-white/10"
                >
                  {plan.cta}
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  className={`w-full py-3.5 rounded-xl text-[15px] font-semibold transition-all cursor-pointer ${
                    plan.ctaStyle === "primary"
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_40px_rgba(37,99,235,0.4)] hover:scale-[1.02]"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.cta}
                </button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Payment notice */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center mb-20 bg-[#0A0A0A] border border-white/[0.06] rounded-2xl p-8"
        >
          <Zap size={24} className="text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Payment integration coming soon</h3>
          <p className="text-[#777] text-sm max-w-[450px] mx-auto mb-4">
            Razorpay payment gateway is being integrated. For now, contact us directly for Pro or Annual access.
          </p>
          <a
            href="mailto:vinay@internos.in?subject=InternOS%20Pro%20Access"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium px-6 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
          >
            <Mail size={16} />
            Contact vinay@internos.in for Pro access
          </a>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-[680px] mx-auto mb-20"
        >
          <h2 className="text-2xl font-bold text-white mb-8 font-mono text-center">
            Pricing FAQ
          </h2>
          {faqs.map((faq, i) => (
            <FAQItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </motion.div>

        {/* Campus plans */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center py-12 border-t border-white/[0.06]"
        >
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-6">
            <Shield size={14} className="text-[#777]" />
            <span className="text-xs text-[#999]">Campus &amp; bulk licensing</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Need InternOS for your entire campus?
          </h3>
          <p className="text-[#666] text-sm max-w-[400px] mx-auto mb-6">
            We offer special pricing for colleges and universities. Get in touch for
            custom plans with admin dashboards and bulk student access.
          </p>
          <a
            href="mailto:vinay@internos.in?subject=InternOS%20Campus%20Plan"
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-white/10 transition-all"
          >
            <Mail size={16} />
            Contact us for campus plans
          </a>
        </motion.div>
      </div>
    </div>
  );
}
