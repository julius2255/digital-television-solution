import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:"Digital Television Solution",
  description:"Professional television automation, studio control, news, media and multi-platform broadcasting.",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
