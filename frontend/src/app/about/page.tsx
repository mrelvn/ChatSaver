import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export const metadata: Metadata = {
  title: "About | ChatSaver",
  description: "Learn how ChatSaver turns useful conversations into an offline-first knowledge library.",
};

export default function AboutPage() {
  return (
    <InformationPage
      eyebrow="About ChatSaver"
      title="Useful conversations deserve a permanent home."
      description="ChatSaver is an offline-first knowledge studio for importing valuable chats, shaping them into editable notes, and finding them again when they matter."
    >
      <section>
        <h2>Built for useful knowledge</h2>
        <p>
          ChatSaver helps turn long AI conversations into a focused library of questions,
          answers, and notes. You choose what to import, what to edit, and what to keep.
        </p>
      </section>
      <section>
        <h2>Local first, sync when you choose</h2>
        <p>
          Your library works from the browser&apos;s local vault. An account is optional and can
          be used to sync your saved material with the ChatSaver database for backup and recovery.
        </p>
      </section>
      <section>
        <h2>Questions or feedback?</h2>
        <p>
          We welcome product feedback and support requests at{" "}
          <a href="mailto:vivekgotstack@gmail.com">vivekgotstack@gmail.com</a>.
        </p>
      </section>
    </InformationPage>
  );
}
