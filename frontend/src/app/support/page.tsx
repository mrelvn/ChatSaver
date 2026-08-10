import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export const metadata: Metadata = {
  title: "Support | ChatSaver",
  description: "Get help with ChatSaver imports, local storage, accounts, and sync.",
};

export default function SupportPage() {
  return (
    <InformationPage
      eyebrow="ChatSaver Support"
      title="Help with your vault, imports, and sync."
      description="For the fastest help, include what you were doing, what you expected, and the exact message shown by the app."
    >
      <section className="border-primary/20! bg-primary/6!">
        <h2>Email support</h2>
        <p>
          Contact <a href="mailto:vivekgotstack@gmail.com">vivekgotstack@gmail.com</a>. Please do
          not send passwords, authentication codes, or sensitive note content.
        </p>
      </section>
      <section>
        <h2>Sync help</h2>
        <p>
          Confirm you are signed in, your device is online, and the sync indicator is not already
          active. Pending items remain safe in the local vault and should change to synced after a
          successful server sync.
        </p>
      </section>
      <section>
        <h2>Import help</h2>
        <p>
          Use a supported ChatGPT export or share link and keep the browser open until processing
          completes. If an import fails, include the file type or link format in your support email.
        </p>
      </section>
      <section>
        <h2>Protect important notes</h2>
        <p>
          ChatSaver is local-first, so clearing browser storage can remove unsynced data. Export a
          vault backup or confirm account sync before clearing site data, changing browsers, or
          moving to another device.
        </p>
      </section>
    </InformationPage>
  );
}
