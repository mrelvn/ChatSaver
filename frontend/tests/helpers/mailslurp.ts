import { MailSlurp } from "mailslurp-client";

const mailSlurp = new MailSlurp({
  apiKey: process.env.MAILSLURP_API_KEY!,
});

export async function createTestInbox() {
  const inbox = await mailSlurp.createInbox();

  return {
    id: inbox.id,
    email: inbox.emailAddress,
  };
}

export async function getOtp(inboxId: string): Promise<string> {
  const email = await mailSlurp.waitForLatestEmail(
    inboxId,
    60_000,
    true
  );

  const body = email.body ?? "";

  const match =
    body.match(/(?:code|otp|verification code)[^0-9]{0,30}(\d{6})/i) ??
    body.match(/\b\d{6}\b/);

  if (!match) {
    throw new Error(`OTP not found in email: ${body}`);
  }

  return match[1];
}