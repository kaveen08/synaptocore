import type { MimeMessageInput } from "./mail.ts";
import { buildMimeMessage } from "./mail.ts";
import type { MailboxCredentials } from "./mailbox.ts";

const encoder = new TextEncoder();

export class SmtpError extends Error {
  constructor(
    message: string,
    readonly responseCode?: number,
  ) {
    super(message);
    this.name = "SmtpError";
  }
}

function bytesToBase64(value: string): string {
  const bytes = encoder.encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
}

function crlfIndex(bytes: Uint8Array): number {
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 13 && bytes[index + 1] === 10) return index;
  }
  return -1;
}

class SmtpSession {
  private buffer = new Uint8Array();
  private readonly decoder = new TextDecoder();

  constructor(private readonly connection: Deno.TlsConn) {}

  async write(value: string): Promise<void> {
    const bytes = encoder.encode(value);
    let offset = 0;
    while (offset < bytes.length) {
      offset += await this.connection.write(bytes.subarray(offset));
    }
  }

  private async readLine(): Promise<string> {
    while (true) {
      const lineEnd = crlfIndex(this.buffer);
      if (lineEnd >= 0) {
        const line = this.decoder.decode(this.buffer.subarray(0, lineEnd));
        this.buffer = this.buffer.slice(lineEnd + 2);
        return line;
      }

      const chunk = new Uint8Array(4096);
      const length = await this.connection.read(chunk);
      if (length === null) {
        throw new SmtpError("Swizzonic closed the SMTP connection.");
      }
      this.buffer = concat(this.buffer, chunk.subarray(0, length));
      if (this.buffer.length > 64 * 1024) {
        throw new SmtpError("Swizzonic returned an oversized SMTP response.");
      }
    }
  }

  async response(expectedCodes: number[]): Promise<string[]> {
    const lines: string[] = [];
    let code: number | undefined;

    while (true) {
      const line = await this.readLine();
      const match = /^(\d{3})([ -])(.*)$/u.exec(line);
      if (!match) throw new SmtpError("Swizzonic returned an invalid response.");
      const lineCode = Number(match[1]);
      code ??= lineCode;
      if (lineCode !== code) {
        throw new SmtpError("Swizzonic returned inconsistent response codes.");
      }
      lines.push(match[3]);
      if (match[2] === " ") break;
    }

    if (!expectedCodes.includes(code)) {
      throw new SmtpError(
        `Swizzonic SMTP ${code}: ${lines.join(" ").slice(0, 300)}`,
        code,
      );
    }
    return lines;
  }

  async command(
    value: string,
    expectedCodes: number[],
  ): Promise<string[]> {
    await this.write(`${value}\r\n`);
    return await this.response(expectedCodes);
  }
}

function smtpAddress(value: string): string {
  const address = value.trim();
  if (
    !/^[^<>\r\n\s@]+@[^<>\r\n\s@]+\.[^<>\r\n\s@]+$/u.test(address)
  ) {
    throw new SmtpError("Invalid SMTP envelope address.");
  }
  return address;
}

async function authenticate(
  session: SmtpSession,
  credentials: MailboxCredentials,
): Promise<void> {
  const capabilities = await session.command("EHLO systemio.ch", [250]);
  const authLine = capabilities.find((line) => /^AUTH(?:=|\s)/iu.test(line)) ??
    "";

  if (/\bPLAIN\b/iu.test(authLine)) {
    await session.command(
      `AUTH PLAIN ${bytesToBase64(`\0${credentials.username}\0${credentials.password}`)}`,
      [235],
    );
    return;
  }

  if (/\bLOGIN\b/iu.test(authLine)) {
    await session.command("AUTH LOGIN", [334]);
    await session.command(bytesToBase64(credentials.username), [334]);
    await session.command(bytesToBase64(credentials.password), [235]);
    return;
  }

  throw new SmtpError(
    "Swizzonic did not offer a supported SMTP authentication method.",
  );
}

async function withSmtpSession<T>(
  credentials: MailboxCredentials,
  action: (session: SmtpSession) => Promise<T>,
): Promise<T> {
  const connection = await Deno.connectTls({
    hostname: credentials.host,
    port: credentials.port,
  });
  const session = new SmtpSession(connection);
  try {
    await session.response([220]);
    await authenticate(session, credentials);
    return await action(session);
  } finally {
    try {
      await session.command("QUIT", [221]);
    } catch {
      // The message/auth result is authoritative even if QUIT cannot complete.
    }
    connection.close();
  }
}

export async function testSmtpCredentials(
  credentials: MailboxCredentials,
): Promise<void> {
  await withSmtpSession(credentials, async () => undefined);
}

export async function sendSmtpMessage(
  credentials: MailboxCredentials,
  input: MimeMessageInput,
): Promise<void> {
  await withSmtpSession(credentials, async (session) => {
    await session.command(
      `MAIL FROM:<${smtpAddress(input.fromEmail)}>`,
      [250],
    );
    await session.command(`RCPT TO:<${smtpAddress(input.to)}>`, [250, 251]);
    await session.command("DATA", [354]);

    const mime = buildMimeMessage(input)
      .replace(/\r?\n/gu, "\r\n")
      .replace(/(^|\r\n)\./gu, "$1..");
    await session.write(`${mime}\r\n.\r\n`);
    await session.response([250]);
  });
}
