import type { Metadata } from "next";
import "./globals.css";
import { ScreenProtectionGuard } from "../components/ScreenProtectionGuard";

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
        <ScreenProtectionGuard>{children}</ScreenProtectionGuard>
      </body>
    </html>
  );
}
