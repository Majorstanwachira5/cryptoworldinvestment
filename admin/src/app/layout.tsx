import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CryptoWorldInvestment (CWI) Administrator Command Authority",
  description: "Dedicated isolated administrator control panel for CryptoWorldInvestment platform operations",
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
