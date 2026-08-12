import type { Metadata } from "next";
import { LibraryApp } from "@/components/library-app";

export const metadata: Metadata = {
  title: "History | ChatSaver",
  description: "Browse your synced ChatSaver history or import a new ChatGPT conversation.",
};

export default function HistoryPage() {
  return <LibraryApp historyView />;
}
