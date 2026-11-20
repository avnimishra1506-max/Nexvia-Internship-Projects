import type { Metadata } from "next";
import "./globals.css";
import "./design.css";

export const metadata: Metadata = {
  title: {
    default: "CollabSpace | Collaborative Workspace",
    template: "%s | CollabSpace",
  },
  description:
    "CollabSpace brings your team together to create, organize, and collaborate in one shared workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "CollabSpace | Collaborative Workspace",
    description:
      "Bring your team together to create, organize, and collaborate in one shared workspace.",
    siteName: "CollabSpace",
    type: "website",
    images: ["/collabspace-logo.svg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}

