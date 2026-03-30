"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Star, Send } from "lucide-react";
import { BETA_CONFIG } from "@/constants/beta";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  if (!BETA_CONFIG.IS_BETA) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback }),
      });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setRating(0);
        setFeedback("");
      }, 2500);
    } catch {
      // silent fail
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 md:bottom-8 right-4 z-50 bg-[#3B82F6] text-white w-12 h-12 rounded-full shadow-lg hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-110 transition-all flex items-center justify-center cursor-pointer"
        aria-label="Feedback"
      >
        <MessageSquare size={20} />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/60 z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-24 md:bottom-20 right-4 z-[61] w-[340px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-white font-semibold text-sm">How&apos;s your experience?</h3>
                <button onClick={() => setOpen(false)} className="text-[#555] hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5">
                {submitted ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                      <Send size={20} className="text-green-400" />
                    </div>
                    <p className="text-white font-medium">Thank you!</p>
                    <p className="text-[#777] text-sm mt-1">Your feedback helps us improve.</p>
                  </div>
                ) : (
                  <>
                    {/* Stars */}
                    <div className="flex justify-center gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onMouseEnter={() => setHover(star)}
                          onMouseLeave={() => setHover(0)}
                          onClick={() => setRating(star)}
                          className="transition-transform hover:scale-110 cursor-pointer"
                        >
                          <Star
                            size={28}
                            className={`transition-colors ${
                              star <= (hover || rating)
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-[#333]"
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    {/* Text */}
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Tell us what you think..."
                      rows={3}
                      className="w-full bg-[#111] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] resize-none focus:border-[#3B82F6] focus:outline-none"
                    />

                    {/* Submit */}
                    <button
                      onClick={handleSubmit}
                      disabled={rating === 0 || sending}
                      className="mt-3 w-full bg-[#3B82F6] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#2563EB] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {sending ? "Sending..." : "Submit Feedback"}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
