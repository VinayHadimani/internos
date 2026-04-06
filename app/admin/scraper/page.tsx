"use client";

import { useState } from 'react';

export default function ScraperAdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [customUrl, setCustomUrl] = useState('');

  const runScraper = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/scraper', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer internos-admin'
        }
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ error: err.message });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Internship Scraper</h1>

        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-2">Auto Scrape All Sources</h2>
          <p className="text-[#666] text-sm mb-4">
            Scrapes Internshala, Unstop and imports to database
          </p>
          <button
            onClick={runScraper}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-400 disabled:bg-[#333] px-6 py-3 rounded-lg font-medium"
          >
            {loading ? 'Scraping...' : 'Run Scraper Now'}
          </button>
        </div>

        {result && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-6">
            <h2 className="font-semibold mb-4">Result</h2>
            {result.error ? (
              <p className="text-red-400">{result.error}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-green-400">✅ {result.message}</p>
                <p className="text-[#888]">Inserted: {result.inserted}</p>
                <p className="text-[#888]">Skipped: {result.skipped}</p>
                <p className="text-[#888]">Errors: {result.errors}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
