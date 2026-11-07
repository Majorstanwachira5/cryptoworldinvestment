import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0e14] text-white p-4">
      <h2 className="text-2xl font-bold text-amber-400 mb-2">404 - Page Not Found</h2>
      <p className="text-slate-400 mb-6 text-sm">The page or resource you requested could not be found.</p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold hover:from-amber-400 hover:to-amber-500 transition-all shadow-md"
      >
        Return to Trading Terminal
      </Link>
    </div>
  );
}

