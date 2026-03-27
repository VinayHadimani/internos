"use client";

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { signIn } = useAuth();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md bg-[#050505] border border-white/10 rounded-2xl shadow-2xl p-8 pointer-events-auto"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-lg"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="text-center mb-8 mt-2">
              <h2 className="text-2xl font-bold text-white mb-2">Sign in to InternOS</h2>
              <p className="text-gray-400">One click. No passwords. No spam.</p>
            </div>

            {/* Google Button */}
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-black font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <img
                src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
                alt="Google logo"
                className="w-5 h-5"
              />
              Continue with Google
            </button>

            {/* Footer */}
            <p className="mt-8 text-center text-xs text-gray-500 max-w-[280px] mx-auto">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
