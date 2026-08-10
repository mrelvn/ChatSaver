import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export const metadata: Metadata = {
  title: "Terms of Service | ChatSaver",
  description: "The terms that apply when using ChatSaver.",
};

export default function TermsPage() {
  return (
    <InformationPage
      eyebrow="Terms of Service · Effective August 4, 2026"
      title="Clear terms for using ChatSaver."
      description="By accessing or using ChatSaver, you agree to these terms. If you do not agree, do not use the service."
    >
      <section>
        <h2>Using the service</h2>
        <p>
          You may use ChatSaver to import, create, edit, store, and sync content that you are
          authorized to use. You are responsible for your account credentials, your devices, and
          activity performed through your account.
        </p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          You retain ownership of the content you save in ChatSaver. You grant ChatSaver only the
          limited permission needed to store, process, sync, back up, and display that content for
          you. You are responsible for ensuring your content does not violate applicable law or the
          rights of others.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>You must not misuse the service, including by attempting to:</p>
        <ul>
          <li>Access accounts, systems, or data without authorization.</li>
          <li>Disrupt, overload, reverse engineer, or bypass service security.</li>
          <li>Upload malware or use ChatSaver for unlawful or abusive activity.</li>
        </ul>
      </section>
      <section>
        <h2>Availability and backups</h2>
        <p>
          ChatSaver is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Features may change,
          and uninterrupted availability is not guaranteed. Because local browser data can be
          cleared by device or browser actions, you should keep appropriate exports or backups of
          important material.
        </p>
      </section>
      <section>
        <h2>Limitation of liability</h2>
        <p>
          To the extent permitted by law, ChatSaver and its operator will not be liable for
          indirect, incidental, special, consequential, or punitive damages, or for loss of data,
          profits, or business arising from use of the service.
        </p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>
          These terms may be updated as the service changes. Continued use after an update means
          you accept the revised terms. Questions can be sent to{" "}
          <a href="mailto:vivekgotstack@gmail.com">vivekgotstack@gmail.com</a>.
        </p>
      </section>
    </InformationPage>
  );
}
