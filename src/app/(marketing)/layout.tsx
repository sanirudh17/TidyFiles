import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TidyFiles | Safe AI Cleanup",
  description: "Clean up messy folders with review-first AI.",
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
