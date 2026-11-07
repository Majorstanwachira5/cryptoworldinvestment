import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CryptoHub Administrator Command Authority (Port 3002)",
  description: "Dedicated isolated administrator control panel for CryptoHub AI platform operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090D16] text-[#F8FAFC] min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
